'use client';

// Modal de compra de VÁRIOS jogos de uma vez, disparado a partir da lista de
// desejos (AccountModal.tsx) quando o cliente marca 2+ jogos e clica em
// "Comprar selecionados". É a mesma ideia do PurchaseModal.tsx (Pix gerado
// no navegador, sem gateway de pagamento, código enviado manualmente depois
// da verificação no WhatsApp), só que com um Pix e uma mensagem cobrindo o
// pedido inteiro, em vez de jogo por jogo.
import { useEffect, useRef, useState, startTransition } from 'react';
import type { Item } from './CatalogClient';
import { StepChecklist, type Checklist } from './PurchaseModal';
import { generatePixPayload, type PixPayload } from '@/lib/pix';
import { logOrderAttempt, getBulkWhatsAppLink } from './orderActions';
import { formatPriceBR } from '@/lib/whatsapp';

type Step = 1 | 2 | 3;

export default function BulkPurchaseModal({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [checklist, setChecklist] = useState<Checklist>({
    semSaldo: false,
    podeTrocarRegiao: false,
    entendeVerificacao: false
  });
  const allChecked = checklist.semSaldo && checklist.podeTrocarRegiao && checklist.entendeVerificacao;

  const [pix, setPix] = useState<PixPayload | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // O link do WhatsApp precisa vir do servidor (ver getBulkWhatsAppLink em
  // orderActions.ts) — WHATSAPP_NUMBER é uma variável sem o prefixo
  // NEXT_PUBLIC_, então só existe no servidor; gerar esse link direto aqui
  // no componente (que roda no navegador) sempre dava erro.
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
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

  // Ao entrar na etapa 2 (pagamento), gera um único Pix pro valor total e
  // registra cada jogo separadamente no histórico de pedidos — assim o
  // admin continua vendo cada jogo individualmente em "📋 Pedidos", só que
  // todos criados no mesmo instante (o que já identifica que vieram do
  // mesmo pedido em lote).
  useEffect(() => {
    if (step !== 2 || startedRef.current) return;
    startedRef.current = true;

    generatePixPayload(total, `${items.length} jogos`)
      .then(setPix)
      .catch((err: Error) => setPixError(err.message));

    getBulkWhatsAppLink(
      items.map((it) => ({ name: it.name, price: it.price })),
      total
    )
      .then(setWhatsappUrl)
      .catch((err: Error) => setWhatsappError(err.message));

    startTransition(() => {
      Promise.all(items.map((it) => logOrderAttempt(it.id, it.name, it.price))).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
    <div className="purchase-modal-overlay" onClick={onClose}>
      <div
        className="purchase-modal"
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
                        <img src={item.imageUrl} alt="" loading="lazy" />
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

              <StepChecklist
                checklist={checklist}
                setChecklist={setChecklist}
                allChecked={allChecked}
                onBack={onClose}
                onNext={() => setStep(2)}
              />
            </>
          )}

          {step === 2 && (
            <BulkStepPayment
              totalLabel={totalLabel}
              pix={pix}
              pixError={pixError}
              copied={copied}
              copyFailed={copyFailed}
              onCopy={handleCopy}
              onBack={() => setStep(1)}
              onPaid={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <BulkStepConfirm whatsappUrl={whatsappUrl} whatsappError={whatsappError} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function BulkStepPayment({
  totalLabel,
  pix,
  pixError,
  copied,
  copyFailed,
  onCopy,
  onBack,
  onPaid
}: {
  totalLabel: string;
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
      <p className="purchase-pix-amount">R$ {totalLabel}</p>

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

      <div className="purchase-warning-box">
        <p>
          Depois de pagar, clique no botão abaixo pra confirmar comigo no WhatsApp. Os códigos dos jogos
          são enviados manualmente, só depois de eu conferir os requisitos com você — isso não é
          automático.
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

function BulkStepConfirm({
  whatsappUrl,
  whatsappError,
  onClose
}: {
  whatsappUrl: string | null;
  whatsappError: string | null;
  onClose: () => void;
}) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (!whatsappUrl || openedRef.current) return;
    openedRef.current = true;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }, [whatsappUrl]);

  if (whatsappError) {
    return (
      <p style={{ color: '#ff8a8a', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
        Não foi possível abrir o WhatsApp: {whatsappError}
      </p>
    );
  }

  if (!whatsappUrl) {
    return <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontWeight: 600 }}>Só um instante...</p>;
  }

  return (
    <>
      <p style={{ textAlign: 'center', fontSize: 40, marginBottom: 10 }}>✓</p>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
        Perfeito! Abrimos o WhatsApp pra você confirmar o pagamento.
      </p>
      <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-dim)', marginBottom: 20 }}>
        Se a conversa não abriu automaticamente,{' '}
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 700 }}>
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
