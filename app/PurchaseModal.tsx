'use client';

// Modal de compra: abre por cima da página quando um jogo é clicado no
// catálogo (veja CatalogClient.tsx, estado `selectedItem`). Tem 4 telas
// internas ("etapas"), controladas pelo estado `step` abaixo — nenhuma delas
// muda a URL ou recarrega a página, é tudo trocar o que aparece dentro
// deste mesmo componente.
//
// IMPORTANTE (segurança contra fraude): este modal NUNCA mostra nem envia o
// código do jogo. Ele só gera o Pix e, depois que o cliente diz que pagou,
// abre uma conversa no WhatsApp com os dados do pedido. A conferência de que
// a conta do cliente está pronta pra resgatar o código — e o envio do
// código em si — continua 100% manual, feita por você no WhatsApp.

import { useEffect, useRef, useState, startTransition } from 'react';
import type { Item } from './CatalogClient';
import type { Platform, GameType } from '@/lib/db';
import { getContrastColor } from '@/lib/color';
import { generatePixPayload, type PixPayload } from '@/lib/pix';
import { logOrderAttempt } from './orderActions';

type Step = 1 | 2 | 3 | 4;

export default function PurchaseModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);

  // As 3 caixinhas da etapa 2. Só avança pro pagamento quando as três forem
  // `true` — é a regra de negócio pedida (conta sem saldo, pode trocar
  // região, entende que o código só sai depois da verificação manual).
  const [checklist, setChecklist] = useState({ semSaldo: false, podeTrocarRegiao: false, entendeVerificacao: false });
  const allChecked = checklist.semSaldo && checklist.podeTrocarRegiao && checklist.entendeVerificacao;

  const [pix, setPix] = useState<PixPayload | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // Índice da captura de tela aberta em tela cheia (a "lightbox"), ou null
  // se nenhuma estiver aberta. Fica aqui em cima (não dentro do StepSummary)
  // porque o Esc precisa saber se é pra fechar só a lightbox ou o modal
  // inteiro — ver o useEffect logo abaixo.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Evita gerar o Pix (e registrar o pedido) mais de uma vez para o mesmo
  // modal, mesmo que o efeito abaixo rode duas vezes em desenvolvimento
  // (o React faz isso de propósito em StrictMode, só pra achar bugs — refs
  // não são resetadas nesse processo, então essa trava funciona certinho).
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

  // Ao entrar na etapa 3 (pagamento), gera o Pix e registra a tentativa de
  // pedido. Tudo roda no navegador — não existe gateway de pagamento nem
  // chamada de API paga envolvida em gerar o QR Code.
  useEffect(() => {
    if (step !== 3 || startedRef.current) return;
    startedRef.current = true;

    generatePixPayload(item.price, item.name)
      .then(setPix)
      .catch((err: Error) => setPixError(err.message));

    // O registro do pedido é só um histórico pra você (admin > Pedidos),
    // não precisa bloquear a tela de pagamento esperando ele terminar —
    // por isso startTransition, que deixa essa chamada rodar "em segundo
    // plano" sem travar a troca de tela.
    startTransition(() => {
      logOrderAttempt(item.id, item.name, item.price).catch(() => {
        // Se o registro falhar (ex: banco fora do ar), a compra em si não
        // deve travar por causa disso — é só um histórico de apoio.
      });
    });
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
            <StepChecklist
              checklist={checklist}
              setChecklist={setChecklist}
              allChecked={allChecked}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <StepPayment
              priceLabel={priceLabel}
              pix={pix}
              pixError={pixError}
              copied={copied}
              copyFailed={copyFailed}
              onCopy={handleCopy}
              onBack={() => setStep(2)}
              onPaid={() => setStep(4)}
            />
          )}

          {step === 4 && <StepConfirm item={item} onClose={onClose} />}
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

  // As setinhas da galeria só rolam a tira de miniaturas — a largura de uma
  // miniatura + o espaçamento entre elas, então cada clique anda "uma foto"
  // por vez, tanto faz o tamanho da tela.
  function scrollGallery(direction: 1 | -1) {
    galleryRef.current?.scrollBy({ left: direction * 124, behavior: 'smooth' });
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
          <button type="button" className="btn primary product-cta" onClick={onNext}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={17} height={17}>
              <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="18" cy="21" r="1.4" fill="currentColor" stroke="none" />
              <path d="M2.5 3h2.4l2.4 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L21.5 7H6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Comprar agora
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

type Checklist = { semSaldo: boolean; podeTrocarRegiao: boolean; entendeVerificacao: boolean };

// Etapa 2 — checklist obrigatório antes de mostrar qualquer forma de
// pagamento. Reaproveita as mesmas 3 regras que já eram combinadas com os
// clientes por WhatsApp, só que agora confirmadas aqui antes de seguir.
function StepChecklist({
  checklist,
  setChecklist,
  allChecked,
  onBack,
  onNext
}: {
  checklist: Checklist;
  setChecklist: (c: Checklist) => void;
  allChecked: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="purchase-checklist">
        <label className="purchase-checklist-item">
          <input
            type="checkbox"
            checked={checklist.semSaldo}
            onChange={(e) => setChecklist({ ...checklist, semSaldo: e.target.checked })}
          />
          <span>Minha conta Nintendo está sem saldo (Brasil e Japão)</span>
        </label>
        <label className="purchase-checklist-item">
          <input
            type="checkbox"
            checked={checklist.podeTrocarRegiao}
            onChange={(e) => setChecklist({ ...checklist, podeTrocarRegiao: e.target.checked })}
          />
          <span>Posso trocar a região da minha conta para o Japão</span>
        </label>
        <label className="purchase-checklist-item">
          <input
            type="checkbox"
            checked={checklist.entendeVerificacao}
            onChange={(e) => setChecklist({ ...checklist, entendeVerificacao: e.target.checked })}
          />
          <span>Entendo que após o pagamento, o código só é enviado depois da verificação desses itens pelo WhatsApp</span>
        </label>
      </div>
      <div className="purchase-modal-actions">
        <button type="button" className="btn primary" disabled={!allChecked} onClick={onNext}>
          Continuar para o pagamento
        </button>
        <button type="button" className="purchase-step-back" onClick={onBack}>
          ← Voltar
        </button>
      </div>
    </>
  );
}

// Etapa 3 — pagamento via Pix: QR Code de verdade (gerado no navegador, sem
// gateway de pagamento) + o texto "Pix Copia e Cola" com botão de copiar.
function StepPayment({
  priceLabel,
  pix,
  pixError,
  copied,
  copyFailed,
  onCopy,
  onBack,
  onPaid
}: {
  priceLabel: string;
  pix: PixPayload | null;
  pixError: string | null;
  copied: boolean;
  copyFailed: boolean;
  onCopy: () => void;
  onBack: () => void;
  onPaid: () => void;
}) {
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

      <div className="purchase-warning-box">
        <p>
          Depois de pagar, clique no botão abaixo pra confirmar comigo no WhatsApp. O código do
          jogo é enviado manualmente, só depois de eu conferir os requisitos com você — isso não
          é automático.
        </p>
      </div>

      <div className="purchase-modal-actions">
        <button type="button" className="btn green" onClick={onPaid}>
          Já paguei — confirmar no WhatsApp
        </button>
        <button type="button" className="purchase-step-back" onClick={onBack}>
          ← Voltar
        </button>
      </div>
    </>
  );
}

// Etapa 4 — dispara o WhatsApp com os dados do pedido já preenchidos, e
// mostra uma tela de confirmação (caso o navegador bloqueie a aba nova, tem
// um link de apoio pra abrir manualmente).
function StepConfirm({ item, onClose }: { item: Item; onClose: () => void }) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    window.open(item.whatsappPaymentUrl, '_blank', 'noopener,noreferrer');
  }, [item]);

  return (
    <>
      <p style={{ textAlign: 'center', fontSize: 40, marginBottom: 10 }}>✓</p>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
        Perfeito! Abrimos o WhatsApp pra você confirmar o pagamento.
      </p>
      <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-dim)', marginBottom: 20 }}>
        Se a conversa não abriu automaticamente,{' '}
        <a href={item.whatsappPaymentUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 700 }}>
          clique aqui
        </a>
        .
      </p>
      <div className="purchase-modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
    </>
  );
}
