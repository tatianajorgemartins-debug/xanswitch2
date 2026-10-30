'use client';

// Modal de compra de VÁRIOS jogos de uma vez, disparado a partir da lista de
// desejos (AccountModal.tsx) quando o cliente marca 2+ jogos e clica em
// "Comprar selecionados". É a mesma ideia do PurchaseModal.tsx (Pix gerado
// no navegador, sem gateway de pagamento, pedido salvo + você avisado
// automaticamente quando o cliente confirma o pagamento), só que com um Pix
// e um pedido cobrindo o total, em vez de jogo por jogo.
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Item } from './CatalogClient';
import {
  StepChecklistAndEmail,
  ReservationTimer,
  RegionTutorial,
  ReferralSourcePicker,
  PaymentLayout,
  CreateAccountOffer
} from './PurchaseModal';
import { XanLoader, useStepLoader } from './XanLoader';
import { CollectibleCard, DownloadCardButton } from './CollectibleCard';
import { generatePixPayload, type PixPayload } from '@/lib/pix';
import { confirmBulkOrderAction } from './orderActions';
import { startBulkPixPaymentAction } from './mercadoPagoActions';
import { usePixPaymentStatus, PixAutoStatus } from './PixAutoConfirm';
import { confirmWithTimeout } from '@/lib/confirmWithTimeout';
import { formatPriceBR } from '@/lib/whatsapp';
import { fallbackToOriginal, IMAGE_SIZES, imageSrcSet } from '@/lib/imageVariants';

type Step = 1 | 2 | 3;

export default function BulkPurchaseModal({
  items,
  user,
  onClose,
  onViewCollection
}: {
  items: Item[];
  user: User | null;
  onClose: () => void;
  onViewCollection: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [referralSource, setReferralSource] = useState<string | null>(null);

  const [pix, setPix] = useState<PixPayload | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // Id da cobrança no Mercado Pago quando o Pix é automático — mesma ideia
  // do PurchaseModal.tsx.
  const [mpPaymentId, setMpPaymentId] = useState<string | null>(null);
  // Valor cobrado de fato (com a taxa do Pix repassada, se configurada).
  const [mpPixCharge, setMpPixCharge] = useState<{ amount: number; feePercent: number } | null>(null);
  const startedRef = useRef(false);

  const total = items.reduce((sum, it) => sum + it.price, 0);
  const totalLabel = total.toFixed(2).replace('.', ',');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Ao entrar na etapa 2 (pagamento), gera um único Pix pro valor total —
  // pelo Mercado Pago quando configurado, senão o Pix de sempre.
  useEffect(() => {
    if (step !== 2 || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const result = await startBulkPixPaymentAction(
        items.map((it) => it.id),
        user?.email ?? email
      );
      if (result.mode === 'mercadopago') {
        setMpPaymentId(result.paymentId);
        setMpPixCharge({ amount: result.amount, feePercent: result.feePercent });
        setPix({ brCode: result.brCode, qrCodeImage: result.qrCodeImage });
      } else if (result.mode === 'error') {
        setPixError(result.error);
      } else {
        setPix(await generatePixPayload(total, `${items.length} jogos`));
      }
    })().catch((err: Error) => setPixError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Pix do Mercado Pago expirou: volta e gera um novo na próxima vez.
  function handlePixExpiredBack() {
    startedRef.current = false;
    setPix(null);
    setPixError(null);
    setMpPaymentId(null);
    setMpPixCharge(null);
    setStep(1);
  }

  // A tela do Pix só aparece com o QR Code pronto — até lá, a tela de
  // carregamento do site (igual ao PurchaseModal.tsx).
  const modalRef = useRef<HTMLDivElement>(null);
  const payment = useStepLoader(modalRef, step === 2, pix !== null || pixError !== null);

  function handleCopy() {
    if (!pix) return;
    navigator.clipboard
      .writeText(pix.brCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 4000);
      });
  }

  return (
    <div className={`purchase-modal-overlay${payment.ready ? '' : ' is-content-loading'}`} onClick={onClose}>
      <XanLoader progress={payment.progress} phase={payment.phase} variant="modal" />
      <div
        ref={modalRef}
        className={`purchase-modal${step === 2 ? ' is-payment-step' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Comprar ${items.length} jogos da lista de desejos`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="purchase-modal-header">
          <span className="purchase-modal-title">Comprar {items.length} jogos</span>
          <button type="button" className="purchase-modal-close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={18} height={18}>
              <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="purchase-modal-body">
          {step === 1 && (
            <>
              <div className="wishlist-list" style={{ marginBottom: 14 }}>
                {items.map((item) => (
                  <div key={item.id} className="wishlist-row">
                    <span className="wishlist-row-cover">
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} srcSet={imageSrcSet(item.imageUrl)} sizes={IMAGE_SIZES.thumb} onError={fallbackToOriginal} alt="" loading="lazy" />
                      )}
                    </span>
                    <span className="wishlist-row-info">
                      <span className="wishlist-row-name">{item.name}</span>
                      <span className="wishlist-row-price">R$ {formatPriceBR(item.price)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="bulk-total-row">
                <span>Total</span>
                <span>R$ {totalLabel}</span>
              </div>

              <StepChecklistAndEmail
                checked={checked}
                onChangeChecked={setChecked}
                email={email}
                setEmail={setEmail}
                user={user}
                onBack={onClose}
                onNext={() => setStep(2)}
              />
            </>
          )}

          {step === 2 && (
            <BulkStepPayment
              items={items}
              total={total}
              totalLabel={mpPixCharge ? mpPixCharge.amount.toFixed(2).replace('.', ',') : totalLabel}
              pixFeePercent={mpPixCharge?.feePercent ?? 0}
              email={user?.email ?? email}
              referralSource={referralSource}
              setReferralSource={setReferralSource}
              mpPaymentId={mpPaymentId}
              onExpiredBack={handlePixExpiredBack}
              pix={pix}
              pixError={pixError}
              copied={copied}
              copyFailed={copyFailed}
              onCopy={handleCopy}
              onBack={() => setStep(1)}
              onConfirmed={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <BulkStepConfirm items={items} pointsConfirmed={mpPaymentId !== null} accountEmail={user ? null : email} onViewCollection={onViewCollection} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function BulkStepPayment({
  items,
  total,
  totalLabel,
  pixFeePercent,
  email,
  referralSource,
  setReferralSource,
  mpPaymentId,
  onExpiredBack,
  pix,
  pixError,
  copied,
  copyFailed,
  onCopy,
  onBack,
  onConfirmed
}: {
  items: Item[];
  total: number;
  totalLabel: string;
  pixFeePercent: number;
  email: string;
  referralSource: string | null;
  setReferralSource: (v: string | null) => void;
  mpPaymentId: string | null;
  onExpiredBack: () => void;
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
  const autoStatus = usePixPaymentStatus(mpPaymentId, referralSource, onConfirmed);

  async function handleConfirm() {
    setConfirming(true);
    setConfirmError(null);
    const result = await confirmWithTimeout(() =>
      confirmBulkOrderAction(
        items.map((it) => ({ id: it.id, name: it.name, price: it.price })),
        total,
        email,
        referralSource
      )
    );
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
    <PaymentLayout
      side={
        <>
          <ReferralSourcePicker value={referralSource} onChange={setReferralSource} />
          <div className="purchase-urgency-box">
            <p>Após o pagamento, seus códigos chegam por e-mail ainda hoje 🎮</p>
          </div>
        </>
      }
    >
      <p className="purchase-pix-amount">R$ {totalLabel}</p>
      {pixFeePercent > 0 && (
        <p className="card-payment-fee-note">
          Valor inclui a taxa de processamento do Pix ({pixFeePercent.toFixed(2).replace('.', ',')}%).
        </p>
      )}

      <ReservationTimer />

      <div className="purchase-pix-qr-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pix.qrCodeImage} alt="QR Code Pix para pagamento" />
      </div>

      <label className="purchase-pix-copy-label" htmlFor="pix-copia-cola-lote">
        Pix Copia e Cola
      </label>
      <div className="purchase-pix-copy-row">
        <input id="pix-copia-cola-lote" type="text" readOnly value={pix.brCode} onFocus={(e) => e.target.select()} />
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

      {mpPaymentId ? (
        <PixAutoStatus status={autoStatus} onBack={autoStatus === 'failed' ? onExpiredBack : onBack} />
      ) : (
        <>
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
      )}
    </PaymentLayout>
  );
}

// Um card por jogo comprado, cada um com seu próprio botão de baixar —
// mesma ideia da revelação de um jogo só (ver StepCardReveal em
// PurchaseModal.tsx), só que em lista, já que uma compra em lote gera vários
// cards de uma vez.
function BulkStepConfirm({
  items,
  pointsConfirmed,
  accountEmail,
  onViewCollection,
  onClose
}: {
  items: Item[];
  // Pago pelo Mercado Pago: os pontos já entraram confirmados.
  pointsConfirmed: boolean;
  // Comprou sem estar logado: e-mail do pedido, pra oferecer criar a conta.
  accountEmail: string | null;
  onViewCollection: () => void;
  onClose: () => void;
}) {
  const totalPoints = items.reduce((sum, it) => sum + it.cardPoints, 0);
  return (
    <>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>
        Pagamento confirmado! Seus códigos chegam no seu e-mail ainda hoje 🎮
      </p>
      <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-dim)', marginBottom: 18 }}>
        E olha só os cards que você ganhou:
      </p>

      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 16 }}>
        🎉 {items.length} {items.length === 1 ? 'card novo' : 'cards novos'}! +{totalPoints}{' '}
        {totalPoints === 1 ? 'ponto' : 'pontos'}
      </p>

      <div className="bulk-card-reveal-list">
        {items.map((item) => (
          <div key={item.id} className="bulk-card-reveal-item">
            <CollectibleCard gameName={item.name} imageUrl={item.imageUrl} points={item.cardPoints} />
            <DownloadCardButton gameName={item.name} imageUrl={item.imageUrl} points={item.cardPoints} />
          </div>
        ))}
      </div>

      <p className="purchase-card-pending-note">
        {pointsConfirmed
          ? 'Seus pontos já estão valendo na sua conta.'
          : 'Seus pontos entram pra valer na sua conta depois que a gente confirmar seu pagamento.'}
      </p>

      {accountEmail && <CreateAccountOffer email={accountEmail} points={totalPoints} />}

      <div className="purchase-modal-actions" style={{ marginTop: 18 }}>
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
