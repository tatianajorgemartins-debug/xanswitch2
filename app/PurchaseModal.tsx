'use client';

// Modal de compra: abre por cima da página quando um jogo é clicado no
// catálogo (veja CatalogClient.tsx, estado `selectedItem`). Tem 4 telas
// internas ("etapas"), controladas pelo estado `step` abaixo — nenhuma delas
// muda a URL ou recarrega a página, é tudo trocar o que aparece dentro
// deste mesmo componente.
//
// IMPORTANTE (segurança contra fraude): este modal NUNCA mostra nem envia o
// código do jogo. Ele só gera o Pix e, depois que o cliente diz que pagou,
// salva o pedido e te avisa automaticamente (e-mail + WhatsApp — veja
// lib/notifications.ts). A conferência de que a conta do cliente está
// pronta pra resgatar o código — e o envio do código em si — continua 100%
// manual, feita por você.

import { useEffect, useRef, useState } from 'react';
import type { Item } from './CatalogClient';
import type { Platform, GameType } from '@/lib/db';
import { getContrastColor } from '@/lib/color';
import { generatePixPayload, type PixPayload } from '@/lib/pix';
import { isValidEmail } from '@/lib/validation';
import { confirmOrderAction } from './orderActions';

type Step = 1 | 2 | 3 | 4;

export default function PurchaseModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);

  // A única confirmação exigida antes do pagamento: a conta precisa estar
  // com saldo zerado (Brasil e Japão), senão o resgate do código não
  // funciona do lado do cliente.
  const [checked, setChecked] = useState(false);

  // E-mail pra onde o código vai depois da confirmação — coletado ANTES do
  // Pix aparecer, pra já ir junto no pedido salvo no banco.
  const [email, setEmail] = useState('');

  const [pix, setPix] = useState<PixPayload | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // Índice da captura de tela aberta em tela cheia (a "lightbox"), ou null
  // se nenhuma estiver aberta. Fica aqui em cima (não dentro do StepSummary)
  // porque o Esc precisa saber se é pra fechar só a lightbox ou o modal
  // inteiro — ver o useEffect logo abaixo.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Evita gerar o Pix mais de uma vez para o mesmo modal, mesmo que o efeito
  // abaixo rode duas vezes em desenvolvimento (o React faz isso de
  // propósito em StrictMode, só pra achar bugs — refs não são resetadas
  // nesse processo, então essa trava funciona certinho).
  const startedRef = useRef(false);

  // Fecha o modal com a tecla Esc, como qualquer modal "de verdade" do
  // navegador — mas se a lightbox de capturas de tela estiver aberta, o
  // primeiro Esc fecha só ela, não o modal inteiro por trás.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (lightboxIndex !== null) {
        setLightboxIndex(null);
      } else {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, lightboxIndex]);

  // Trava o scroll da página de fundo enquanto o modal está aberto, senão
  // dá pra rolar o catálogo "por trás" dele, o que é estranho no celular.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Ao entrar na etapa 3 (pagamento), gera o Pix. Tudo roda no navegador —
  // não existe gateway de pagamento nem chamada de API paga envolvida em
  // gerar o QR Code.
  useEffect(() => {
    if (step !== 3 || startedRef.current) return;
    startedRef.current = true;

    generatePixPayload(item.price, item.name)
      .then(setPix)
      .catch((err: Error) => setPixError(err.message));
  }, [step, item]);

  function handleCopy() {
    if (!pix) return;
    navigator.clipboard
      .writeText(pix.brCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        // Alguns navegadores/contextos bloqueiam a área de transferência
        // (ex: sem permissão, ou site aberto fora de HTTPS). Nesse caso o
        // campo de texto já está selecionado (veja onFocus no <input>), então
        // a pessoa ainda consegue copiar manualmente com Ctrl+C.
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 4000);
      });
  }

  const priceLabel = item.price.toFixed(2).replace('.', ',');

  return (
    // Clicar no fundo escurecido fecha o modal; clicar dentro da caixa não
    // (por isso o stopPropagation lá dentro) — é o comportamento padrão que
    // qualquer usuário já espera de um modal.
    <div className="purchase-modal-overlay" onClick={onClose}>
      <div
        className={`purchase-modal${step === 1 ? ' is-product-step' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Comprar ${item.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="purchase-modal-header">
          <span className="purchase-modal-title">{item.name}</span>
          <button type="button" className="purchase-modal-close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={18} height={18}>
              <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="purchase-modal-body">
          {step === 1 && (
            <StepSummary
              item={item}
              priceLabel={priceLabel}
              onNext={() => setStep(2)}
              onOpenScreenshot={setLightboxIndex}
            />
          )}

          {step === 2 && (
            <StepChecklistAndEmail
              checked={checked}
              onChangeChecked={setChecked}
              email={email}
              setEmail={setEmail}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <StepPayment
              gameId={item.id}
              gameName={item.name}
              price={item.price}
              priceLabel={priceLabel}
              email={email}
              pix={pix}
              pixError={pixError}
              copied={copied}
              copyFailed={copyFailed}
              onCopy={handleCopy}
              onBack={() => setStep(2)}
              onConfirmed={() => setStep(4)}
            />
          )}

          {step === 4 && <StepConfirm onClose={onClose} />}
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          screenshots={item.screenshots}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}

// Nomes de exibição pra plataforma e tipo de jogo, pra montar a "ficha
// técnica" (Plataforma / Tipo / Formato) — mesma ideia das etiquetas que já
// existem no card do catálogo, só que por extenso aqui, que tem mais espaço.
const PLATFORM_LABEL: Record<Platform, string> = {
  switch1: 'Nintendo Switch',
  switch2: 'Nintendo Switch 2',
  both: 'Switch 1 e 2'
};
const GAME_TYPE_LABEL: Record<GameType, string> = {
  base: 'Jogo base',
  dlc: 'DLC',
  update: 'Atualização'
};

// Etapa 1 — resumo do jogo, no estilo de uma página de produto de loja:
// capa grande com faixa de destaque, galeria de fotos, título, preço e uma
// "ficha técnica" curta, antes da descrição e do botão de compra. Tudo isso
// já vem pronto do catálogo — nada é buscado de novo aqui.
function StepSummary({
  item,
  priceLabel,
  onNext,
  onOpenScreenshot
}: {
  item: Item;
  priceLabel: string;
  onNext: () => void;
  onOpenScreenshot: (index: number) => void;
}) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // As setinhas da galeria só rolam a tira de miniaturas — a largura de uma
  // miniatura + o espaçamento entre elas, então cada clique anda "uma foto"
  // por vez, tanto faz o tamanho da tela.
  function scrollGallery(direction: 1 | -1) {
    galleryRef.current?.scrollBy({ left: direction * 124, behavior: 'smooth' });
  }

  // Cada jogo tem um link próprio (/jogo/<id>) que já abre direto nessa
  // mesma tela — é o que dá pra compartilhar nas redes sociais e mostrar
  // uma prévia com a capa e o nome do jogo (ver generateMetadata em
  // app/jogo/[id]/page.tsx). No celular, usa o menu de compartilhar nativo
  // quando disponível; senão, copia o link (mesmo padrão do "Copiar" do
  // Pix, mais abaixo no modal).
  async function handleShare() {
    const url = `${window.location.origin}/jogo/${item.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: `Dá uma olhada em ${item.name} na XAN Switch!`, url });
      } catch {
        // Cancelar o compartilhamento não é um erro — só não faz nada.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Sem clipboard disponível, não tem fallback silencioso melhor do
      // que simplesmente não fazer nada.
    }
  }

  return (
    // Em telas largas isso vira duas colunas (foto/galeria de um lado,
    // informações do outro — como numa página de produto de loja de
    // verdade); no celular, uma coluna só, tudo empilhado na mesma ordem.
    <div className="product-layout">
      <div className="product-media">
        <div className="product-hero-cover">
          {item.hasBadge && (
            <div
              className="product-hero-ribbon"
              style={{ background: item.badgeColor, color: getContrastColor(item.badgeColor) }}
            >
              {item.badgeText}
            </div>
          )}
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} />
          )}
        </div>

        {item.screenshots.length > 0 && (
          <div className="product-gallery-row">
            <button
              type="button"
              className="product-gallery-arrow"
              onClick={() => scrollGallery(-1)}
              aria-label="Rolar capturas de tela pra esquerda"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={14} height={14}>
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="purchase-gallery" ref={galleryRef}>
              {item.screenshots.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  className="purchase-gallery-thumb"
                  onClick={() => onOpenScreenshot(i)}
                  aria-label={`Ver captura de tela ${i + 1} em tamanho maior`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="product-gallery-arrow"
              onClick={() => scrollGallery(1)}
              aria-label="Rolar capturas de tela pra direita"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={14} height={14}>
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="product-info">
        {item.franchise && <p className="product-eyebrow">{item.franchise}</p>}
        <h2 className="product-title">{item.name}</h2>
        <div className="product-price-row">
          {item.originalPriceLabel && <span className="product-price-old">R$ {item.originalPriceLabel}</span>}
          <span className="product-price">R$ {priceLabel}</span>
        </div>

        <div className="product-meta-grid">
          <div className="product-meta-chip">
            <p className="product-meta-chip-label">Plataforma</p>
            <p className="product-meta-chip-value">{PLATFORM_LABEL[item.platform]}</p>
          </div>
          <div className="product-meta-chip">
            <p className="product-meta-chip-label">Tipo</p>
            <p className="product-meta-chip-value">{GAME_TYPE_LABEL[item.gameType]}</p>
          </div>
          <div className="product-meta-chip">
            <p className="product-meta-chip-label">Formato</p>
            <p className="product-meta-chip-value">Código digital</p>
          </div>
        </div>

        {item.description && (
          <div className="purchase-description">
            <p className="purchase-description-label">Sobre o jogo</p>
            <p className="purchase-description-text">{item.description}</p>
          </div>
        )}

        <div className="purchase-modal-actions">
          {item.creditPaymentUrl ? (
            <>
              <p className="purchase-payment-choice-label">Como você quer pagar?</p>
              <div className="purchase-payment-choice">
                <button type="button" className="btn primary product-cta" onClick={onNext}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={17} height={17}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Pix à vista
                </button>
                <a
                  href={item.creditPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn credit product-cta"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={17} height={17}>
                    <rect x="1.5" y="5" width="21" height="14" rx="2.2" />
                    <path d="M1.5 10h21" strokeLinecap="round" />
                  </svg>
                  Crédito parcelado
                </a>
              </div>
            </>
          ) : (
            <button type="button" className="btn primary product-cta" onClick={onNext}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={17} height={17}>
                <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="18" cy="21" r="1.4" fill="currentColor" stroke="none" />
                <path d="M2.5 3h2.4l2.4 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L21.5 7H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Comprar agora
            </button>
          )}
          <button type="button" className="btn ghost" onClick={handleShare}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={15} height={15}>
              <path d="M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {shareCopied ? 'Link copiado!' : 'Compartilhar este jogo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Visualização ampliada de uma captura de tela, aberta por cima do próprio
// modal. Dá pra passar pra próxima/anterior sem fechar e reabrir.
function Lightbox({
  screenshots,
  index,
  onClose,
  onNavigate
}: {
  screenshots: string[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const hasMultiple = screenshots.length > 1;

  return (
    // stopPropagation aqui é o que impede um clique no fundo da lightbox de
    // "vazar" pro overlay do modal por trás e fechar tudo de uma vez.
    <div className="purchase-lightbox-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <button
        type="button"
        className="purchase-lightbox-close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Fechar"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={18} height={18}>
          <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
        </svg>
      </button>

      {hasMultiple && (
        <button
          type="button"
          className="purchase-lightbox-nav prev"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index - 1 + screenshots.length) % screenshots.length);
          }}
          aria-label="Captura de tela anterior"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={20} height={20}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={screenshots[index]} alt="" onClick={(e) => e.stopPropagation()} />

      {hasMultiple && (
        <button
          type="button"
          className="purchase-lightbox-nav next"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index + 1) % screenshots.length);
          }}
          aria-label="Próxima captura de tela"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={20} height={20}>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Etapa 2 — a única confirmação exigida antes do pagamento (saldo zerado) e
// o e-mail pra onde o código vai depois, juntos na mesma tela. Exportado
// porque a compra em lote da lista de desejos (BulkPurchaseModal) usa
// exatamente a mesma etapa, uma única vez pra todos os jogos selecionados,
// em vez de repetir por jogo.
export function StepChecklistAndEmail({
  checked,
  onChangeChecked,
  email,
  setEmail,
  onBack,
  onNext
}: {
  checked: boolean;
  onChangeChecked: (v: boolean) => void;
  email: string;
  setEmail: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canContinue = checked && isValidEmail(email);
  return (
    <>
      <div className="purchase-checklist">
        <label className="purchase-checklist-item">
          <input type="checkbox" checked={checked} onChange={(e) => onChangeChecked(e.target.checked)} />
          <span>Minha conta Nintendo está com saldo zerado (Brasil e Japão)</span>
        </label>
      </div>

      <p className="purchase-email-intro">
        É pra esse e-mail que enviaremos o código do jogo depois da confirmação do pagamento.
      </p>
      <label className="purchase-email-label" htmlFor="purchase-email-input">
        Seu e-mail
      </label>
      <input
        id="purchase-email-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="seuemail@exemplo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <div className="purchase-modal-actions" style={{ marginTop: 20 }}>
        <button type="button" className="btn primary" disabled={!canContinue} onClick={onNext}>
          Continuar para o pagamento
        </button>
        <button type="button" className="purchase-step-back" onClick={onBack}>
          ← Voltar
        </button>
      </div>
    </>
  );
}

const RESERVATION_SECONDS = 15 * 60; // 15 minutos — reforço psicológico, não trava nada de verdade (código digital não tem estoque físico limitado).

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Timer visual de "pedido reservado" — puramente psicológico, pra estimular
// o pagamento rápido. Não bloqueia nada quando chega a zero (fica parado em
// 00:00): um código digital não tem estoque físico, então não existe
// "perder a reserva" de verdade. Reinicia sozinho se a pessoa recarregar a
// tela, porque o tempo vive só aqui, em memória do componente.
export function ReservationTimer() {
  const [secondsLeft, setSecondsLeft] = useState(RESERVATION_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="purchase-timer-box">
      <span aria-hidden="true">⏳</span>
      <span>
        Esse pedido fica reservado por <strong>{formatCountdown(secondsLeft)}</strong>
      </span>
    </div>
  );
}

// Etapa 4 — pagamento via Pix: QR Code de verdade (gerado no navegador, sem
// gateway de pagamento) + o texto "Pix Copia e Cola" com botão de copiar,
// timer de reserva e o botão que salva o pedido e dispara os avisos
// automáticos (ver confirmOrderAction em orderActions.ts).
function StepPayment({
  gameId,
  gameName,
  price,
  priceLabel,
  email,
  pix,
  pixError,
  copied,
  copyFailed,
  onCopy,
  onBack,
  onConfirmed
}: {
  gameId: number;
  gameName: string;
  price: number;
  priceLabel: string;
  email: string;
  pix: PixPayload | null;
  pixError: string | null;
  copied: boolean;
  copyFailed: boolean;
  onCopy: () => void;
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function handleConfirm() {
    setConfirming(true);
    setConfirmError(null);
    const result = await confirmOrderAction(gameId, gameName, price, email);
    if (result.ok) {
      onConfirmed();
    } else {
      setConfirmError(result.error);
      setConfirming(false);
    }
  }

  if (pixError) {
    return (
      <>
        <p style={{ color: '#ff8a8a', fontSize: 14, fontWeight: 600, textAlign: 'center', marginBottom: 18 }}>
          Não foi possível gerar o Pix agora: {pixError}
        </p>
        <button type="button" className="purchase-step-back" onClick={onBack}>
          ← Voltar
        </button>
      </>
    );
  }

  if (!pix) {
    return <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontWeight: 600 }}>Gerando o QR Code do Pix...</p>;
  }

  return (
    <>
      <p className="purchase-pix-amount">R$ {priceLabel}</p>

      <ReservationTimer />

      <div className="purchase-pix-qr-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pix.qrCodeImage} alt="QR Code Pix para pagamento" />
      </div>

      <label className="purchase-pix-copy-label" htmlFor="pix-copia-cola">
        Pix Copia e Cola
      </label>
      <div className="purchase-pix-copy-row">
        <input id="pix-copia-cola" type="text" readOnly value={pix.brCode} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn ghost" onClick={onCopy}>
          Copiar
        </button>
      </div>
      {copied && <p className="purchase-copy-feedback">✓ Código copiado!</p>}
      {copyFailed && (
        <p className="purchase-copy-feedback" style={{ color: '#ffd24e' }}>
          Não consegui copiar automaticamente — clique no campo acima e use Ctrl+C.
        </p>
      )}

      <div className="purchase-urgency-box">
        <p>Após o pagamento, seu código chega por e-mail ainda hoje 🎮</p>
      </div>

      {confirmError && (
        <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>
          {confirmError}
        </p>
      )}

      <div className="purchase-modal-actions">
        <button type="button" className="btn green" onClick={handleConfirm} disabled={confirming}>
          {confirming ? 'Confirmando...' : 'Já paguei — confirmar pedido'}
        </button>
        <button type="button" className="purchase-step-back" onClick={onBack} disabled={confirming}>
          ← Voltar
        </button>
      </div>
    </>
  );
}

// Etapa 5 — tela final, depois que o pedido já foi salvo e as notificações
// automáticas já foram disparadas (ver StepPayment acima).
function StepConfirm({ onClose }: { onClose: () => void }) {
  return (
    <>
      <p style={{ textAlign: 'center', fontSize: 40, marginBottom: 10 }}>✓</p>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
        Pagamento confirmado! Seu código chega no seu e-mail ainda hoje 🎮
      </p>
      <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-dim)', marginBottom: 20 }}>
        Guarde esse e-mail à mão — é pra ele que o código vai.
      </p>

      <RegionTutorial />

      <div className="purchase-modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
    </>
  );
}

// Tutorial de como trocar a região da conta Nintendo pra Japão — necessário
// pra resgatar os códigos, que são da eShop japonesa. Mostrado só depois da
// confirmação do pagamento (StepConfirm acima e BulkStepConfirm em
// BulkPurchaseModal.tsx), já que é nesse momento que o cliente precisa
// desse passo a passo. A imagem mora em public/, servida direto pelo Next
// como um arquivo estático (não é conteúdo do catálogo, então não precisa
// passar pelo Supabase).
export function RegionTutorial() {
  return (
    <div className="purchase-region-tutorial">
      <p className="purchase-region-tutorial-label">Como trocar a região da sua conta Nintendo pra Japão:</p>
      <a href="/tutorial-troca-regiao.png" target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tutorial-troca-regiao.png" alt="Tutorial: como mudar a região da conta Nintendo de Brasil para Japão" />
      </a>
      <p className="purchase-region-tutorial-hint">Toque na imagem pra ver em tela cheia</p>
    </div>
  );
}
