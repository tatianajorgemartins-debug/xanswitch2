'use client';

// Etapa 3 (variante cartão pelo Mercado Pago) — o pagamento no cartão
// acontece aqui mesmo, dentro da janela de compra, de dois jeitos:
//
// - Cartão novo: o formulário é desenhado pelo próprio Mercado Pago (o
//   "Card Payment Brick", carregado do site dele). O número do cartão vai
//   direto pra lá e volta só um "token", que o servidor usa pra cobrar
//   (payWithCardAction em mercadoPagoActions.ts). Quem está logado pode
//   marcar "Salvar cartão para próximas compras".
// - Cartão salvo (só pra quem está logado): lista os cartões guardados no
//   Mercado Pago e pede só o CVV, num campo seguro do Mercado Pago — o CVV
//   nunca fica guardado em lugar nenhum, por regra das bandeiras.
//
// Em nenhum dos dois o número do cartão passa pelo site ou pelo banco.
//
// Só aparece quando NEXT_PUBLIC_MP_PUBLIC_KEY está configurada (ver
// PurchaseModal.tsx); sem ela, o crédito continua no link externo por jogo.
import { useEffect, useRef, useState } from 'react';
import {
  deleteSavedCardAction,
  getCardChargeAction,
  getSavedCardsAction,
  payWithCardAction,
  type CardPaymentResult
} from './mercadoPagoActions';
import type { CardInput, SavedCard } from '@/lib/mercadoPago';
import { formatPriceBR } from '@/lib/whatsapp';
import { getAccessToken } from '@/lib/wishlist';
import { usePixPaymentStatus, PixAutoStatus } from './PixAutoConfirm';
import { PaymentLayout, ReferralSourcePicker } from './PurchaseModal';

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const BRICK_CONTAINER_ID = 'mp-card-payment-brick';
const CVV_CONTAINER_ID = 'mp-saved-card-cvv';
const NEW_CARD = 'new';

type BrickController = { unmount: () => void };
type FieldInstance = { mount: (containerId: string) => FieldInstance; unmount: () => void };
type CardData = {
  token: string;
  issuer_id?: string | null;
  payment_method_id: string;
  installments: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
};
type AdditionalData = { paymentTypeId?: string } | undefined;
type MercadoPagoInstance = {
  bricks: () => {
    create: (brick: 'cardPayment', containerId: string, settings: unknown) => Promise<BrickController>;
  };
  fields: {
    create: (field: 'securityCode', options: { placeholder: string; style?: Record<string, string> }) => FieldInstance;
    createCardToken: (options: { cardId: string }) => Promise<{ id: string }>;
  };
  getInstallments: (options: {
    amount: string;
    bin: string;
    paymentTypeId?: string;
  }) => Promise<{ payer_costs: { installments: number; recommended_message: string; total_amount: number }[] }[]>;
};
type MercadoPagoSdk = new (publicKey: string, options: { locale: string }) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoSdk;
  }
}

// Carrega o script do Mercado Pago uma vez só, na primeira vez que alguém
// abre o pagamento no cartão (não pesa no carregamento do catálogo), e usa
// uma instância só pra página inteira.
let mpPromise: Promise<MercadoPagoInstance> | null = null;
function loadMercadoPago(publicKey: string): Promise<MercadoPagoInstance> {
  if (!mpPromise) {
    mpPromise = new Promise<MercadoPagoSdk>((resolve, reject) => {
      if (window.MercadoPago) return resolve(window.MercadoPago);
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => (window.MercadoPago ? resolve(window.MercadoPago) : reject(new Error('sdk')));
      script.onerror = () => reject(new Error('sdk'));
      document.head.appendChild(script);
    })
      .then((MercadoPago) => new MercadoPago(publicKey, { locale: 'pt-BR' }))
      .catch((err) => {
        mpPromise = null;
        throw err;
      });
  }
  return mpPromise;
}

const CONNECTION_ERROR: CardPaymentResult = {
  status: 'rejected',
  error: 'A conexão falhou. Confira se o pagamento não caiu antes de tentar de novo.'
};

export function CardPaymentStep({
  gameId,
  email,
  loggedIn,
  splitPixId = null,
  offerToken = null,
  onReadyChange,
  referralSource,
  setReferralSource,
  onBack,
  onConfirmed
}: {
  gameId: number;
  email: string;
  // Cartões salvos (e a caixinha de salvar) só existem pra quem tem conta.
  loggedIn: boolean;
  // Pix + cartão (SplitPaymentStep.tsx): o id do Pix já pago — o cartão
  // cobra só o que falta.
  splitPixId?: string | null;
  // Link exclusivo: o servidor cobra o preço especial do link.
  offerToken?: string | null;
  // Avisa a janela de compra quando a tela pode aparecer (formulário
  // carregado, ou um erro pra mostrar) — até lá fica a tela de
  // carregamento do site (useStepLoader em PurchaseModal.tsx).
  onReadyChange: (ready: boolean) => void;
  referralSource: string | null;
  setReferralSource: (v: string | null) => void;
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? '';
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Valor no cartão (com a taxa repassada) e no Pix, calculados no servidor
  // (getCardChargeAction) antes de o formulário abrir — as parcelas são
  // calculadas em cima desse valor.
  const [charge, setCharge] = useState<{ amount: number; feePercent: number; pixAmount: number } | null>(null);
  // null = ainda carregando (ou buscando os cartões salvos).
  const [savedCards, setSavedCards] = useState<SavedCard[] | null>(loggedIn ? null : []);
  // Cartão escolhido: o id de um cartão salvo, ou NEW_CARD.
  const [selected, setSelected] = useState(NEW_CARD);
  const [saveCard, setSaveCard] = useState(true);
  // Cada recusa recria o formulário do zero (o token do cartão só vale
  // uma tentativa) — mudar esse número remonta o Brick.
  const [attempt, setAttempt] = useState(0);
  // Compra em análise pelo antifraude: espera a decisão, igual ao Pix.
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const pendingStatus = usePixPaymentStatus(pendingPaymentId, referralSource, onConfirmed);

  // Pagamento com cartão salvo: parcelas disponíveis e envio em andamento.
  // total: quanto o cliente paga no fim nessa opção (com os juros das
  // parcelas, que ficam com ele) — é o valor mostrado no botão de pagar.
  const [installmentOptions, setInstallmentOptions] = useState<{ installments: number; label: string; total: number }[]>([]);
  const [installments, setInstallments] = useState(1);
  const [paying, setPaying] = useState(false);

  // Lidos na hora do envio pelo onSubmit do Brick, que é criado antes.
  const referralAtSubmit = useRef(referralSource);
  referralAtSubmit.current = referralSource;
  const saveCardAtSubmit = useRef(saveCard);
  saveCardAtSubmit.current = saveCard;

  useEffect(() => {
    let cancelled = false;
    getCardChargeAction(gameId, splitPixId, offerToken)
      .then((result) => {
        if (cancelled) return;
        if (result) setCharge(result);
        else setLoadError(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, splitPixId, offerToken]);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    getAccessToken()
      .then((token) => getSavedCardsAction(token))
      .then((cards) => {
        if (cancelled) return;
        setSavedCards(cards);
        if (cards.length > 0) setSelected(cards[0].id);
      })
      .catch(() => {
        if (!cancelled) setSavedCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  const showable = ready || loadError || pendingPaymentId !== null;
  useEffect(() => {
    onReadyChange(showable);
  }, [showable, onReadyChange]);
  useEffect(() => () => onReadyChange(false), [onReadyChange]);

  function handleResult(result: CardPaymentResult) {
    if (result.status === 'approved') {
      onConfirmed();
    } else if (result.status === 'pending') {
      setPendingPaymentId(result.paymentId);
    } else {
      setError(result.error);
      setAttempt((n) => n + 1);
    }
  }

  // Cartão novo: o formulário do Mercado Pago.
  useEffect(() => {
    if (pendingPaymentId || !charge || savedCards === null || selected !== NEW_CARD || !publicKey) return;
    let cancelled = false;
    let controller: BrickController | null = null;
    setReady(false);

    loadMercadoPago(publicKey)
      .then((mp) => {
        if (cancelled) return null;
        return mp.bricks().create('cardPayment', BRICK_CONTAINER_ID, {
          initialization: { amount: charge.amount, payer: { email } },
          customization: {
            paymentMethods: { maxInstallments: 12, types: { excluded: ['debit_card', 'prepaid-card'] } },
            // Sem o título "Cartão de crédito ou débito": economiza altura
            // pra tela de pagamento caber sem rolar no computador.
            visual: { hideFormTitle: true, style: { theme: 'dark', customVariables: { baseColor: '#7b4df5' } } }
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onError: (err: unknown) => console.error('[mercadopago] Formulário de cartão:', err),
            onSubmit: async (cardData: CardData, additionalData: AdditionalData) => {
              setError(null);
              const identification = cardData.payer?.identification;
              const wantsToSave = loggedIn && saveCardAtSubmit.current;
              const card: CardInput = {
                token: cardData.token,
                paymentMethodId: cardData.payment_method_id,
                paymentTypeId: additionalData?.paymentTypeId ?? 'credit_card',
                installments: cardData.installments,
                issuerId: cardData.issuer_id ?? null,
                identification:
                  identification?.type && identification.number
                    ? { type: identification.type, number: identification.number }
                    : null
              };
              const result = await payWithCardAction(gameId, email, card, referralAtSubmit.current, {
                accessToken: wantsToSave ? await getAccessToken() : null,
                savedCardId: null,
                saveCard: wantsToSave,
                splitPixId,
                offerToken
              }).catch(() => CONNECTION_ERROR);
              handleResult(result);
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
  }, [attempt, pendingPaymentId, charge, savedCards, selected]);

  const selectedCard = savedCards?.find((c) => c.id === selected) ?? null;

  // Cartão salvo: campo seguro do CVV (do Mercado Pago) + parcelas pra esse
  // cartão e esse valor.
  useEffect(() => {
    if (pendingPaymentId || !charge || !selectedCard || !publicKey) return;
    let cancelled = false;
    let field: FieldInstance | null = null;
    setReady(false);
    setInstallmentOptions([]);
    setInstallments(1);

    loadMercadoPago(publicKey)
      .then(async (mp) => {
        if (cancelled) return;
        // O campo é um quadro seguro do Mercado Pago (o CSS do site não
        // alcança lá dentro) — a cor do texto vai aqui, branca como os
        // outros campos da janela.
        field = mp.fields
          .create('securityCode', { placeholder: 'CVV', style: { color: '#ffffff', fontSize: '16px' } })
          .mount(CVV_CONTAINER_ID);
        const options = await mp
          .getInstallments({ amount: charge.amount.toFixed(2), bin: selectedCard.firstSix, paymentTypeId: selectedCard.paymentTypeId })
          .catch(() => []);
        if (cancelled) return;
        const costs = options[0]?.payer_costs ?? [];
        setInstallmentOptions(
          costs.length > 0
            ? costs
                .filter((c) => c.installments <= 12)
                .map((c) => ({ installments: c.installments, label: c.recommended_message, total: c.total_amount }))
            : [{ installments: 1, label: `1x de R$ ${formatPriceBR(charge.amount)}`, total: charge.amount }]
        );
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      field?.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, pendingPaymentId, charge, selectedCard?.id]);

  async function handlePayWithSavedCard() {
    if (!selectedCard || !publicKey) return;
    setPaying(true);
    setError(null);
    try {
      const mp = await loadMercadoPago(publicKey);
      // O token sai do cartão salvo + o CVV digitado no campo seguro.
      const token = await mp.fields.createCardToken({ cardId: selectedCard.id });
      const result = await payWithCardAction(
        gameId,
        email,
        {
          token: token.id,
          paymentMethodId: selectedCard.brand,
          paymentTypeId: selectedCard.paymentTypeId,
          installments,
          issuerId: selectedCard.issuerId,
          identification: null
        },
        referralSource,
        { accessToken: await getAccessToken(), savedCardId: selectedCard.id, saveCard: false, splitPixId, offerToken }
      ).catch(() => CONNECTION_ERROR);
      handleResult(result);
    } catch {
      setError('Confira o código de segurança (CVV) do cartão e tente de novo.');
    } finally {
      setPaying(false);
    }
  }

  async function handleRemoveCard(card: SavedCard) {
    if (!window.confirm(`Remover o cartão ${card.brandName} final ${card.lastFour}?`)) return;
    const result = await deleteSavedCardAction(await getAccessToken(), card.id).catch(() => ({ ok: false }));
    if (!result.ok) {
      setError('Não foi possível remover o cartão agora. Tente de novo.');
      return;
    }
    const remaining = (savedCards ?? []).filter((c) => c.id !== card.id);
    setSavedCards(remaining);
    if (selected === card.id) setSelected(remaining[0]?.id ?? NEW_CARD);
  }

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
    <PaymentLayout
      side={
        <>
          <ReferralSourcePicker value={referralSource} onChange={setReferralSource} />
          <div className="purchase-urgency-box">
            <p>Pagamento processado pelo Mercado Pago. Aprovou, seu código chega por e-mail ainda hoje 🎮</p>
          </div>
        </>
      }
    >
      {charge && (
        <>
          <p className="purchase-pix-amount">R$ {formatPriceBR(charge.amount)}</p>
          {charge.feePercent > 0 && splitPixId ? (
            <p className="card-payment-fee-note">
              Valor inclui a taxa de processamento do cartão ({formatPriceBR(charge.feePercent)}%) sobre a parte do cartão.
            </p>
          ) : charge.feePercent > 0 && (
            // Aviso exigido pra cobrar diferente por forma de pagamento (Lei
            // 13.455/2017): o cliente vê o valor e o porquê antes de pagar.
            <p className="card-payment-fee-note">
              No cartão, o valor inclui a taxa de processamento de {formatPriceBR(charge.feePercent)}%. No Pix sai por
              R$ {formatPriceBR(charge.pixAmount)}.
            </p>
          )}
        </>
      )}

      {error && (
        <p className="card-payment-error" role="alert">
          {error}
        </p>
      )}

      {savedCards && savedCards.length > 0 && (
        <div className="saved-cards" role="radiogroup" aria-label="Escolha o cartão">
          {savedCards.map((card) => (
            <div key={card.id} className={`saved-card${selected === card.id ? ' is-selected' : ''}`}>
              <label className="saved-card-option">
                <input
                  type="radio"
                  name="saved-card"
                  checked={selected === card.id}
                  onChange={() => {
                    setSelected(card.id);
                    setError(null);
                  }}
                />
                <span className="saved-card-name">
                  {card.brandName} <span aria-hidden="true">••••</span> {card.lastFour}
                </span>
                <span className="saved-card-exp">
                  vence {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                </span>
              </label>
              <button type="button" className="saved-card-remove" onClick={() => handleRemoveCard(card)}>
                Remover
              </button>
            </div>
          ))}
          <div className={`saved-card${selected === NEW_CARD ? ' is-selected' : ''}`}>
            <label className="saved-card-option">
              <input
                type="radio"
                name="saved-card"
                checked={selected === NEW_CARD}
                onChange={() => {
                  setSelected(NEW_CARD);
                  setError(null);
                }}
              />
              <span className="saved-card-name">Usar outro cartão</span>
            </label>
          </div>
        </div>
      )}

      {loadError ? (
        <p className="card-payment-error" role="alert">
          Não foi possível carregar o pagamento com cartão agora. Recarregue a página ou pague com Pix.
        </p>
      ) : selectedCard ? (
        <div className="saved-card-pay">
          <label className="purchase-email-label" htmlFor={CVV_CONTAINER_ID}>
            Código de segurança (CVV) do cartão final {selectedCard.lastFour}
          </label>
          <div id={CVV_CONTAINER_ID} className="saved-card-cvv" />

          <label className="purchase-email-label" htmlFor="saved-card-installments">
            Parcelas
          </label>
          <select
            id="saved-card-installments"
            className="saved-card-installments"
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
            disabled={!ready || paying}
          >
            {installmentOptions.map((o) => (
              <option key={o.installments} value={o.installments}>
                {o.label}
              </option>
            ))}
          </select>

          <button type="button" className="btn primary product-cta" onClick={handlePayWithSavedCard} disabled={!ready || paying}>
            {paying
              ? 'Processando...'
              : charge
                ? `Pagar R$ ${formatPriceBR(installmentOptions.find((o) => o.installments === installments)?.total ?? charge.amount)}`
                : 'Pagar'}
          </button>
        </div>
      ) : (
        <>
          {loggedIn && savedCards !== null && (
            <label className="saved-card-save">
              <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
              Salvar cartão para próximas compras
            </label>
          )}
          {!ready && <p className="card-payment-loading">Carregando o pagamento seguro do Mercado Pago...</p>}
          <div id={BRICK_CONTAINER_ID} className="card-payment-brick" />
        </>
      )}

      <div className="purchase-modal-actions">
        <button type="button" className="purchase-step-back" onClick={onBack}>
          ← Voltar
        </button>
      </div>
    </PaymentLayout>
  );
}
