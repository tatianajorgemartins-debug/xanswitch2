'use client';

// Pix automático (Mercado Pago): no lugar do botão "Já paguei", a tela
// fica perguntando ao servidor se o Pix caiu — a cada poucos segundos e
// também na hora que a pessoa volta pro site depois de pagar no app do
// banco. Usado pelo PurchaseModal.tsx e pelo BulkPurchaseModal.tsx.
import { useEffect, useRef, useState } from 'react';
import { checkPixPaymentAction } from './mercadoPagoActions';

const POLL_INTERVAL_MS = 4000;

export function usePixPaymentStatus(
  paymentId: string | null,
  referralSource: string | null,
  onApproved: () => void
): 'pending' | 'failed' {
  const [status, setStatus] = useState<'pending' | 'failed'>('pending');
  // Sempre a resposta mais recente de "como você conheceu a loja?" e o
  // callback atual, sem reiniciar o intervalo a cada mudança.
  const referralRef = useRef(referralSource);
  referralRef.current = referralSource;
  const onApprovedRef = useRef(onApproved);
  onApprovedRef.current = onApproved;

  useEffect(() => {
    if (!paymentId) return;
    let stopped = false;
    let inFlight = false;

    async function check() {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const result = await checkPixPaymentAction(paymentId as string, referralRef.current);
        if (stopped) return;
        if (result === 'approved') {
          stopped = true;
          onApprovedRef.current();
        } else if (result === 'failed') {
          stopped = true;
          setStatus('failed');
        }
      } catch {
        // Sem conexão agora — tenta de novo na próxima volta.
      } finally {
        inFlight = false;
      }
    }

    const timer = setInterval(check, POLL_INTERVAL_MS);
    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [paymentId]);

  return status;
}

export function PixAutoStatus({ status, onBack }: { status: 'pending' | 'failed'; onBack: () => void }) {
  if (status === 'failed') {
    return (
      <div className="purchase-modal-actions">
        <p className="pix-auto-status is-failed" role="alert">
          Esse Pix expirou ou foi cancelado. Volte e gere um novo — se você chegou a pagar, fala com a gente no WhatsApp.
        </p>
        <button type="button" className="purchase-step-back" onClick={onBack}>
          ← Voltar
        </button>
      </div>
    );
  }
  return (
    <div className="purchase-modal-actions">
      <p className="pix-auto-status" role="status">
        <span className="pix-auto-status-dot" aria-hidden="true" />
        Aguardando o pagamento — essa tela avança sozinha assim que o Pix cair.
      </p>
      <button type="button" className="purchase-step-back" onClick={onBack}>
        ← Voltar
      </button>
    </div>
  );
}
