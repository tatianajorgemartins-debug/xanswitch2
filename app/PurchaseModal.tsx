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
import type { User } from '@supabase/supabase-js';
import type { Item } from './CatalogClient';
import type { Platform, GameType } from '@/lib/db';
import { getContrastColor } from '@/lib/color';
import { generatePixPayload, type PixPayload } from '@/lib/pix';
import { isValidEmail, REFERRAL_SOURCES } from '@/lib/validation';
import { signUp, signIn, translateAuthError, getAccessToken } from '@/lib/wishlist';
import { CollectibleCard, DownloadCardButton } from './CollectibleCard';
import { confirmOrderAction, confirmCreditOrderAction } from './orderActions';
import { getCheckoutDiscountAction } from './cardActions';

type Step = 1 | 2 | 3 | 4;

export default function PurchaseModal({
  item,
  user,
  onClose,
  onViewCollection
}: {
  item: Item;
  user: User | null;
  onClose: () => void;
  onViewCollection: () => void;
}) {
  const [step, setStep] = useState<Step>(1);

  // Qual forma de pagamento foi escolhida na etapa 1 — define o que a
  // etapa 3 mostra (Pix com QR Code, ou o link externo de crédito
  // parcelado). Os dois caminhos passam pela mesma etapa de e-mail/conta
  // (etapa 2) e os dois premiam o card colecionável no final.
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credito'>('pix');

  // A única confirmação exigida antes do pagamento: a conta precisa estar
  // com saldo zerado (Brasil e Japão), senão o resgate do código não
  // funciona do lado do cliente.
  const [checked, setChecked] = useState(false);

  // E-mail pra onde o código vai depois da confirmação — coletado ANTES do
  // Pix aparecer, pra já ir junto no pedido salvo no banco.
  const [email, setEmail] = useState('');

  // "Como você conheceu a loja?" — opcional, marcado na tela de pagamento
  // (ver ReferralSourcePicker mais abaixo). null se a pessoa não responder.
  const [referralSource, setReferralSource] = useState<string | null>(null);

  const [pix, setPix] = useState<PixPayload | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // Desconto de fidelidade: só faz sentido perguntar se esse jogo aceita
  // (marcado no admin) — 'checking' busca se há crédito disponível pra essa
  // conta, 'offer' mostra a pergunta "usar o desconto?", 'done' é o estado
  // final (sem oferta, ou já resolvido) — só a partir dele o Pix é gerado,
  // pra garantir que o Pix mostrado já saia com o valor certo.
  const [discountStage, setDiscountStage] = useState<'checking' | 'offer' | 'done'>(
    item.discountEligible ? 'checking' : 'done'
  );
  const [availableDiscountAmount, setAvailableDiscountAmount] = useState(0);
  const [discountApplied, setDiscountApplied] = useState(false);

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

  // Ao entrar na etapa 3, antes de gerar o Pix, checa se tem um desconto de
  // fidelidade pronto pra usar nesse jogo — só se o jogo aceitar desconto e
  // a pessoa estiver logada. Roda uma vez só (a troca de estado pra 'offer'
  // ou 'done' impede rodar de novo).
  useEffect(() => {
    if (step !== 3 || discountStage !== 'checking') return;
    if (paymentMethod !== 'pix') {
      // Desconto de fidelidade só vale pro Pix — no crédito parcelado o
      // pagamento acontece inteiramente num link externo, sem como ajustar
      // o valor cobrado por lá.
      setDiscountStage('done');
      return;
    }
    let cancelled = false;
    getAccessToken()
      .then((token) => {
        if (!token) return null;
        return getCheckoutDiscountAction(token);
      })
      .then((result) => {
        if (cancelled) return;
        if (result?.available) {
          setAvailableDiscountAmount(result.amount);
          setDiscountStage('offer');
        } else {
          setDiscountStage('done');
        }
      })
      .catch(() => {
        if (!cancelled) setDiscountStage('done');
      });
    return () => {
      cancelled = true;
    };
  }, [step, discountStage, paymentMethod]);

  // O valor final já considera o desconto escolhido na oferta acima — o Pix
  // só é gerado depois que esse valor está definitivo (discountStage ===
  // 'done'), pra nunca mostrar um QR Code com o valor errado.
  const effectivePrice = discountApplied ? Math.max(0, item.price - availableDiscountAmount) : item.price;

  // Ao entrar na etapa 3 (pagamento), já com o valor final decidido, gera o
  // Pix. Tudo roda no navegador — não existe gateway de pagamento nem
  // chamada de API paga envolvida em gerar o QR Code.
  useEffect(() => {
    if (step !== 3 || discountStage !== 'done' || paymentMethod !== 'pix' || startedRef.current) return;
    startedRef.current = true;

    generatePixPayload(effectivePrice, item.name)
      .then(setPix)
      .catch((err: Error) => setPixError(err.message));
  }, [step, discountStage, paymentMethod, effectivePrice, item]);

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
              onNext={(method) => {
                setPaymentMethod(method);
                setStep(2);
              }}
              onOpenScreenshot={setLightboxIndex}
            />
          )}

          {step === 2 && (
            <StepChecklistAndEmail
              checked={checked}
              onChangeChecked={setChecked}
              email={email}
              setEmail={setEmail}
              user={user}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && paymentMethod === 'pix' && (discountStage === 'checking' || discountStage === 'offer') && (
            <DiscountOffer
              stage={discountStage}
              amount={availableDiscountAmount}
              price={item.price}
              onChoose={(useDiscount) => {
                setDiscountApplied(useDiscount);
                setDiscountStage('done');
              }}
            />
          )}

          {step === 3 && paymentMethod === 'pix' && discountStage === 'done' && (
            <StepPayment
              gameId={item.id}
              gameName={item.name}
              price={item.price}
              priceLabel={effectivePrice.toFixed(2).replace('.', ',')}
              email={user?.email ?? email}
              referralSource={referralSource}
              setReferralSource={setReferralSource}
              applyDiscount={discountApplied}
              pix={pix}
              pixError={pixError}
              copied={copied}
              copyFailed={copyFailed}
              onCopy={handleCopy}
              onBack={() => setStep(2)}
              onConfirmed={() => setStep(4)}
            />
          )}

          {step === 3 && paymentMethod === 'credito' && (
            <StepCreditPayment
              gameId={item.id}
              gameName={item.name}
              price={item.price}
              priceLabel={priceLabel}
              email={user?.email ?? email}
              creditPaymentUrl={item.creditPaymentUrl}
              referralSource={referralSource}
              setReferralSource={setReferralSource}
              onBack={() => setStep(2)}
              onConfirmed={() => setStep(4)}
            />
          )}

          {step === 4 && (
            <StepCardReveal
              gameName={item.name}
              imageUrl={item.imageUrl}
              points={item.cardPoints}
              paymentMethod={paymentMethod}
              onViewCollection={onViewCollection}
              onClose={onClose}
            />
          )}
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
  onNext: (method: 'pix' | 'credito') => void;
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

        <div className="purchase-card-teaser">
          <span className="purchase-card-teaser-icon" aria-hidden="true">
            🎴
          </span>
          <p>
            Ao comprar, você ganha o <strong>card colecionável</strong> de {item.name} + <strong>{item.cardPoints}
            {item.cardPoints === 1 ? ' ponto' : ' pontos'}</strong> pra trocar por desconto
          </p>
        </div>

        <div className="purchase-modal-actions">
          {item.creditPaymentUrl ? (
            <>
              <p className="purchase-payment-choice-label">Como você quer pagar?</p>
              <div className="purchase-payment-choice">
                <button type="button" className="btn primary product-cta" onClick={() => onNext('pix')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={17} height={17}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Pix à vista
                </button>
                <button type="button" className="btn credit product-cta" onClick={() => onNext('credito')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={17} height={17}>
                    <rect x="1.5" y="5" width="21" height="14" rx="2.2" />
                    <path d="M1.5 10h21" strokeLinecap="round" />
                  </svg>
                  Crédito parcelado
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn primary product-cta" onClick={() => onNext('pix')}>
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

// Etapa 2 — a única confirmação exigida antes do pagamento (saldo zerado),
// o e-mail pra onde o código vai depois, e — se ainda não estiver logado —
// uma senha pra criar a conta na hora, onde os cards colecionáveis ficam
// guardados (ver seção "Gamificação" do README). Exportado porque a compra
// em lote da lista de desejos (BulkPurchaseModal) usa exatamente a mesma
// etapa, uma única vez pra todos os jogos selecionados, em vez de repetir
// por jogo — nesse caso `user` nunca vem nulo, porque só dá pra chegar
// nessa tela já logado (a lista de desejos exige login antes).
export function StepChecklistAndEmail({
  checked,
  onChangeChecked,
  email,
  setEmail,
  user,
  onBack,
  onNext
}: {
  checked: boolean;
  onChangeChecked: (v: boolean) => void;
  email: string;
  setEmail: (v: string) => void;
  user: User | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const emailValid = user ? true : isValidEmail(email);
  const passwordValid = user ? true : password.length >= 6;
  const canContinue = checked && emailValid && passwordValid && !submitting;

  // Se já está logado, não precisa criar conta nenhuma — só segue. Se não,
  // tenta criar a conta com o e-mail e senha que acabou de digitar; se esse
  // e-mail já tiver conta (erro "User already registered"), tenta entrar
  // com a mesma senha em vez de criar de novo — assim a pessoa não precisa
  // saber de antemão se já tem conta ou não, só usa sempre o mesmo campo.
  async function handleContinue() {
    if (user) {
      onNext();
      return;
    }
    setSubmitting(true);
    setAuthError(null);
    const trimmedEmail = email.trim();
    try {
      const { confirmedImmediately } = await signUp(trimmedEmail, password);
      if (!confirmedImmediately) {
        // Só acontece se "Confirm email" ainda estiver ligado no Supabase
        // (veja o README) — deixa a compra seguir mesmo assim; o card só
        // não aparece em "Minha coleção" até a pessoa confirmar o e-mail e
        // entrar por conta própria depois.
        onNext();
        return;
      }
      onNext();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'User already registered') {
        try {
          await signIn(trimmedEmail, password);
          onNext();
          return;
        } catch {
          setAuthError('Esse e-mail já tem conta — digite a senha certa dela pra continuar.');
          setSubmitting(false);
          return;
        }
      }
      setAuthError(translateAuthError(message || 'Não foi possível continuar.'));
      setSubmitting(false);
    }
  }

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

      {user ? (
        <p className="purchase-account-status">
          Logado como <strong>{user.email}</strong> — seu card colecionável vai direto pra sua conta.
        </p>
      ) : (
        <>
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
            disabled={submitting}
            style={{ marginBottom: 14 }}
          />

          <p className="purchase-email-intro">
            Crie uma senha pra guardar seu card colecionável e seus pontos numa conta XAN Switch.
          </p>
          <label className="purchase-email-label" htmlFor="purchase-password-input">
            Senha (pelo menos 6 caracteres)
          </label>
          <input
            id="purchase-password-input"
            type="password"
            autoComplete="new-password"
            minLength={6}
            placeholder="Pelo menos 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </>
      )}

      {authError && (
        <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '10px 0 0' }}>{authError}</p>
      )}

      <div className="purchase-modal-actions" style={{ marginTop: 20 }}>
        <button type="button" className="btn primary" disabled={!canContinue} onClick={handleContinue}>
          {submitting ? 'Só um instante...' : 'Continuar para o pagamento'}
        </button>
        <button type="button" className="purchase-step-back" onClick={onBack} disabled={submitting}>
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

// "Como você conheceu a loja?" — opcional, aparece na tela de pagamento.
// Exportado porque o BulkPurchaseModal usa o mesmo seletor. A resposta vai
// junto do pedido salvo no banco e aparece pra você em /admin > Pedidos.
export function ReferralSourcePicker({
  value,
  onChange
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="purchase-referral">
      <p className="purchase-referral-label">Como você conheceu a XAN Switch? (opcional)</p>
      <div className="purchase-referral-options">
        {REFERRAL_SOURCES.map((option) => (
          <label key={option} className="purchase-referral-item">
            <input type="radio" name="referralSource" checked={value === option} onChange={() => onChange(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Aparece só quando o jogo aceita desconto de fidelidade E a pessoa tem um
// crédito de R$20 disponível (ver getCheckoutDiscountAction) — pergunta se
// quer usar esse desconto NESSA compra antes de gerar o Pix, já que o valor
// do QR Code depende dessa escolha.
function DiscountOffer({
  stage,
  amount,
  price,
  onChoose
}: {
  stage: 'checking' | 'offer';
  amount: number;
  price: number;
  onChoose: (useDiscount: boolean) => void;
}) {
  if (stage === 'checking') {
    return <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontWeight: 600 }}>Verificando desconto disponível...</p>;
  }

  const amountLabel = amount.toFixed(2).replace('.', ',');
  const finalLabel = Math.max(0, price - amount).toFixed(2).replace('.', ',');

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 34, marginBottom: 8 }}>🎟️</p>
      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 8 }}>
        Você tem R$ {amountLabel} de desconto disponível!
      </p>
      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.5, marginBottom: 20 }}>
        Quer usar esse desconto nessa compra? O valor final ficaria em <strong>R$ {finalLabel}</strong>.
      </p>
      <div className="purchase-modal-actions">
        <button type="button" className="btn primary" onClick={() => onChoose(true)}>
          Usar meu desconto
        </button>
        <button type="button" className="btn ghost" onClick={() => onChoose(false)}>
          Não, pagar o valor cheio
        </button>
      </div>
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
  referralSource,
  setReferralSource,
  applyDiscount,
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
  referralSource: string | null;
  setReferralSource: (v: string | null) => void;
  applyDiscount: boolean;
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
    const accessToken = applyDiscount ? await getAccessToken() : null;
    const result = await confirmOrderAction(gameId, gameName, price, email, referralSource, applyDiscount, accessToken);
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

      <ReferralSourcePicker value={referralSource} onChange={setReferralSource} />

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

// Etapa 3 (variante crédito parcelado) — explica que o pagamento acontece
// num link externo (configurado por você no admin), pergunta "como você
// conheceu a loja?" e, ao clicar em "Continuar pro pagamento", abre o link
// numa aba nova E registra o pedido com o e-mail já coletado na etapa 2 —
// é esse registro que premia o card colecionável, igual já acontecia só no
// Pix (ver confirmCreditOrderAction em orderActions.ts).
function StepCreditPayment({
  gameId,
  gameName,
  price,
  priceLabel,
  email,
  creditPaymentUrl,
  referralSource,
  setReferralSource,
  onBack,
  onConfirmed
}: {
  gameId: number;
  gameName: string;
  price: number;
  priceLabel: string;
  email: string;
  creditPaymentUrl: string | null;
  referralSource: string | null;
  setReferralSource: (v: string | null) => void;
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function handleContinue() {
    if (!creditPaymentUrl) return;
    // window.open primeiro, de forma síncrona — se ficasse esperando a
    // Server Action abaixo terminar, alguns navegadores tratariam a aba
    // nova como um popup não solicitado pelo clique e bloqueariam.
    window.open(creditPaymentUrl, '_blank', 'noopener,noreferrer');

    setConfirming(true);
    setConfirmError(null);
    const result = await confirmCreditOrderAction(gameId, gameName, price, email, referralSource);
    if (result.ok) {
      onConfirmed();
    } else {
      setConfirmError(result.error);
      setConfirming(false);
    }
  }

  return (
    <>
      <p className="purchase-pix-amount">R$ {priceLabel}</p>

      <div className="purchase-urgency-box">
        <p>
          O pagamento parcelado acontece numa aba separada, fora da XAN Switch. Ao clicar em "Continuar pro
          pagamento", abrimos essa aba e já registramos seu pedido aqui — seu card colecionável é liberado na
          hora. Conclua o pagamento por lá; seu código chega por e-mail assim que a gente confirmar.
        </p>
      </div>

      <ReferralSourcePicker value={referralSource} onChange={setReferralSource} />

      {confirmError && (
        <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>
          {confirmError}
        </p>
      )}

      <div className="purchase-modal-actions">
        <button type="button" className="btn credit" onClick={handleContinue} disabled={confirming}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={17} height={17}>
            <rect x="1.5" y="5" width="21" height="14" rx="2.2" />
            <path d="M1.5 10h21" strokeLinecap="round" />
          </svg>
          {confirming ? 'Registrando...' : 'Continuar pro pagamento'}
        </button>
        <button type="button" className="purchase-step-back" onClick={onBack} disabled={confirming}>
          ← Voltar
        </button>
      </div>
    </>
  );
}

// Etapa 4 — tela final, depois que o pedido já foi salvo e as notificações
// automáticas já foram disparadas (ver StepPayment acima). Mostra o card
// colecionável ganho nessa compra, com a animação de revelação (ver
// CollectibleCard.tsx), o botão de baixar o card como PNG e o botão pra ver
// a coleção completa (abre "Minha conta" — ver AccountModal.tsx).
function StepCardReveal({
  gameName,
  imageUrl,
  points,
  paymentMethod,
  onViewCollection,
  onClose
}: {
  gameName: string;
  imageUrl: string | null;
  points: number;
  paymentMethod: 'pix' | 'credito';
  onViewCollection: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>
        {paymentMethod === 'pix'
          ? 'Pagamento confirmado! Seu código chega no seu e-mail ainda hoje 🎮'
          : 'Pedido registrado! Conclua o pagamento na aba que abrimos — seu código chega por e-mail assim que confirmarmos 🎮'}
      </p>
      <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-dim)', marginBottom: 18 }}>
        E olha só o que você ganhou:
      </p>

      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 16 }}>
        🎉 Você ganhou o card de {gameName}! +{points} {points === 1 ? 'ponto' : 'pontos'}
      </p>

      <CollectibleCard gameName={gameName} imageUrl={imageUrl} points={points} />

      <p className="purchase-card-pending-note">
        Seus pontos entram pra valer na sua conta depois que a gente confirmar seu pagamento.
      </p>

      <div className="purchase-modal-actions" style={{ marginTop: 18 }}>
        <DownloadCardButton gameName={gameName} imageUrl={imageUrl} points={points} />
        <button type="button" className="btn primary" onClick={onViewCollection}>
          Ver minha coleção
        </button>
      </div>

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
