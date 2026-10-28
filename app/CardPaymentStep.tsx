'use client';

// Etapa 3 (variante cartão pelo Mercado Pago) — o formulário de cartão
// aparece aqui mesmo, dentro da janela de compra. Quem desenha o formulário
// é o próprio Mercado Pago (o "Card Payment Brick", carregado do site
// dele): o número do cartão vai direto pra lá e volta só um "token", que o
// servidor usa pra cobrar (payWithCardAction em mercadoPagoActions.ts).
// Assim o número do cartão nunca passa pelo site nem pelo banco de dados.
//
// Só aparece quando NEXT_PUBLIC_MP_PUBLIC_KEY está configurada (ver
// PurchaseModal.tsx); sem ela, o crédito continua no link externo por jogo.
import { useEffect, useRef, useState } from 'react';
import { payWithCardAction } from './mercadoPagoActions';
import { usePixPaymentStatus, PixAutoStatus } from './PixAutoConfirm';
import { ReferralSourcePicker } from './PurchaseModal';

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const CONTAINER_ID = 'mp-card-payment-brick';

type BrickController = { unmount: () => void };
type CardData = {
  token: string;
  issuer_id?: string | null;
  payment_method_id: string;
  installments: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
};
type AdditionalData = { paymentTypeId?: string } | undefined;
type MercadoPagoSdk = new (
  publicKey: string,
  options: { locale: string }
) => {
  bricks: () => {
    create: (brick: 'cardPayment', containerId: string, settings: unknown) => Promise<BrickController>;
  };
};

declare global {
  interface Window {
    MercadoPago?: MercadoPagoSdk;
  }
}

// Carrega o script do Mercado Pago uma vez só, na primeira vez que alguém
// abre o pagamento no cartão (não pesa no carregamento do catálogo).
let sdkPromise: Promise<MercadoPagoSdk> | null = null;
function loadSdk(): Promise<MercadoPagoSdk> {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => (window.MercadoPago ? resolve(window.MercadoPago) : reject(new Error('sdk')));
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error('sdk'));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

export function CardPaymentStep({
  gameId,
  price,
  priceLabel,
  email,
  referralSource,
  setReferralSource,
  onBack,
  onConfirmed
}: {
  gameId: number;
  price: number;
  priceLabel: string;
  email: string;
  referralSource: string | null;
  setReferralSource: (v: string | null) => void;
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cada recusa recria o formulário do zero (o token do cartão só vale
  // uma tentativa) — mudar esse número remonta o Brick.
  const [attempt, setAttempt] = useState(0);
  // Compra em análise pelo antifraude: espera a decisão, igual ao Pix.
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const pendingStatus = usePixPaymentStatus(pendingPaymentId, referralSource, onConfirmed);

  // O "como você conheceu a loja?" é lido na hora do envio, não na criação
  // do formulário — por isso fica numa variável que o onSubmit enxerga.
  const referralAtSubmit = useRef(referralSource);
  referralAtSubmit.current = referralSource;

  useEffect(() => {
    if (pendingPaymentId) return;
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) return;
    let cancelled = false;
    let controller: BrickController | null = null;
    setReady(false);

    loadSdk()
      .then((MercadoPago) => {
        if (cancelled) return null;
        const mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
        return mp.bricks().create('cardPayment', CONTAINER_ID, {
          initialization: { amount: price, payer: { email } },
          customization: {
            paymentMethods: { maxInstallments: 12, types: { excluded: ['debit_card', 'prepaid-card'] } },
            visual: { style: { theme: 'dark', customVariables: { baseColor: '#7b4df5' } } }
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onError: (err: unknown) => console.error('[mercadopago] Formulário de cartão:', err),
            onSubmit: async (cardData: CardData, additionalData: AdditionalData) => {
              setError(null);
              const identification = cardData.payer?.identification;
              const result = await payWithCardAction(
                gameId,
                email,
                {
                  token: cardData.token,
                  paymentMethodId: cardData.payment_method_id,
                  paymentTypeId: additionalData?.paymentTypeId ?? 'credit_card',
                  installments: cardData.installments,
                  issuerId: cardData.issuer_id ?? null,
                  identification:
                    identification?.type && identification.number
                      ? { type: identification.type, number: identification.number }
                      : null
                },
                referralAtSubmit.current
              ).catch(() => ({
                status: 'rejected' as const,
                error: 'A conexão falhou. Confira se o pagamento não caiu antes de tentar de novo.'
              }));
              if (result.status === 'approved') {
                onConfirmed();
              } else if (result.status === 'pending') {
                setPendingPaymentId(result.paymentId);
              } else {
                setError(result.error);
                setAttempt((n) => n + 1);
              }
            }
          }
        });
      })
      .then((created) => {
        if (!created) return;
        if (cancelled) created.unmount();
        else controller = created;
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      controller?.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, pendingPaymentId]);

  if (pendingPaymentId) {
    return (
      <PixAutoStatus
        status={pendingStatus}
        onBack={onBack}
        pendingText="Seu pagamento está em análise pelo Mercado Pago — essa tela avança sozinha quando for aprovado."
        failedText="O pagamento não foi aprovado na análise. Tente outro cartão ou pague com Pix."
      />
    );
  }

  return (
    <>
      <p className="purchase-pix-amount">R$ {priceLabel}</p>

      {error && (
        <p className="card-payment-error" role="alert">
          {error}
        </p>
      )}

      {loadError ? (
        <p className="card-payment-error" role="alert">
          Não foi possível carregar o pagamento com cartão agora. Recarregue a página ou pague com Pix.
        </p>
      ) : (
        <>
          {!ready && <p className="card-payment-loading">Carregando o pagamento seguro do Mercado Pago...</p>}
          <div id={CONTAINER_ID} className="card-payment-brick" />
        </>
      )}

      <ReferralSourcePicker value={referralSource} onChange={setReferralSource} />

      <div className="purchase-urgency-box">
        <p>Pagamento processado pelo Mercado Pago. Aprovou, seu código chega por e-mail ainda hoje 🎮</p>
      </div>

      <div className="purchase-modal-actions">
        <button type="button" className="purchase-step-back" onClick={onBack}>
          ← Voltar
        </button>
      </div>
    </>
  );
}
