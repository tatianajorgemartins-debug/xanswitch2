'use client';

// Etapa 3 (variante Pix + cartão) — uma parte do jogo no Pix e o resto no
// cartão, tudo pelo Mercado Pago, em três passos na mesma janela:
//
// 1. A pessoa escolhe quanto vai no Pix (o resto aparece na hora como
//    "no cartão").
// 2. Paga o Pix (QR Code / Copia e Cola). A tela avança sozinha quando cai.
// 3. Paga o resto no cartão (o mesmo CardPaymentStep do "Crédito
//    parcelado", só que cobrando a diferença — ver splitPixId).
//
// O pedido só é criado quando as duas partes estão pagas (ver
// lib/mercadoPagoOrders.ts). Se a pessoa fechar a janela depois do Pix, o
// id dele fica guardado no navegador (SPLIT_STORAGE_PREFIX): ao abrir o
// mesmo jogo de novo, PurchaseModal.tsx oferece continuar direto no cartão.
import { useEffect, useState } from 'react';
import { startSplitPixPaymentAction } from './mercadoPagoActions';
import { usePixPaymentStatus, PixAutoStatus } from './PixAutoConfirm';
import { CardPaymentStep } from './CardPaymentStep';
import { PaymentLayout, ReferralSourcePicker, ReservationTimer } from './PurchaseModal';
import { formatPriceBR } from '@/lib/whatsapp';

export const SPLIT_STORAGE_PREFIX = 'xan-split-pix-';
const MIN_PART = 5;

export type SplitResume = { pixId: string; pixPart: number; cardPart: number };

export function rememberSplitPix(gameId: number, pixId: string, email: string) {
  try {
    localStorage.setItem(SPLIT_STORAGE_PREFIX + gameId, JSON.stringify({ pixId, email }));
  } catch {
    // Sem armazenamento (aba anônima etc.): só não dá pra retomar depois.
  }
}

export function readSplitPix(gameId: number): { pixId: string; email: string } | null {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_PREFIX + gameId);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.pixId === 'string' && typeof parsed.email === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function forgetSplitPix(gameId: number) {
  try {
    localStorage.removeItem(SPLIT_STORAGE_PREFIX + gameId);
  } catch {
    // nada a fazer
  }
}

function parseReais(text: string): number {
  // "150,50" ou "150.50" — com vírgula, ponto é separador de milhar.
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

export function SplitPaymentStep({
  gameId,
  price,
  email,
  loggedIn,
  resume,
  onReadyChange,
  referralSource,
  setReferralSource,
  onBack,
  onConfirmed
}: {
  gameId: number;
  price: number;
  email: string;
  loggedIn: boolean;
  // Pix já pago numa visita anterior: começa direto no cartão.
  resume: SplitResume | null;
  onReadyChange: (ready: boolean) => void;
  referralSource: string | null;
  setReferralSource: (v: string | null) => void;
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const [phase, setPhase] = useState<'choose' | 'pix' | 'card'>(resume ? 'card' : 'choose');
  const [pixText, setPixText] = useState(() => formatPriceBR(Math.round(price / 2)));
  const [pixPart, setPixPart] = useState(resume?.pixPart ?? 0);
  const [cardPart, setCardPart] = useState(resume?.cardPart ?? 0);
  const [pixId, setPixId] = useState<string | null>(resume?.pixId ?? null);
  const [pix, setPix] = useState<{ brCode: string; qrCodeImage: string; amount: number; feePercent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const typed = parseReais(pixText);
  const maxPart = Math.floor((price - MIN_PART) * 100) / 100;
  const valid = Number.isFinite(typed) && typed >= MIN_PART && typed <= maxPart;
  const rest = valid ? Math.round((price - typed) * 100) / 100 : null;

  const pixStatus = usePixPaymentStatus(phase === 'pix' ? pixId : null, referralSource, () => setPhase('card'));

  // Escolher o valor e o QR Code aparecem na hora; no cartão, quem avisa
  // é o próprio CardPaymentStep (formulário do Mercado Pago carregado).
  useEffect(() => {
    if (phase !== 'card') onReadyChange(true);
  }, [phase, onReadyChange]);

  async function handleStart() {
    if (!valid) return;
    setStarting(true);
    setError(null);
    const result = await startSplitPixPaymentAction(gameId, email, typed).catch(() => ({
      mode: 'error' as const,
      error: 'A conexão falhou. Tente de novo.'
    }));
    setStarting(false);
    if (result.mode !== 'mercadopago') {
      setError(result.mode === 'error' ? result.error : 'Pix + cartão indisponível no momento.');
      return;
    }
    rememberSplitPix(gameId, result.paymentId, email);
    setPixId(result.paymentId);
    setPixPart(typed);
    setCardPart(Math.round((price - typed) * 100) / 100);
    setPix({ brCode: result.brCode, qrCodeImage: result.qrCodeImage, amount: result.amount, feePercent: result.feePercent });
    setPhase('pix');
  }

  function handleCopy() {
    if (!pix) return;
    navigator.clipboard
      .writeText(pix.brCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});
  }

  const side = (
    <>
      <ReferralSourcePicker value={referralSource} onChange={setReferralSource} />
      <div className="purchase-urgency-box">
        <p>Seu código chega por e-mail ainda hoje, assim que as duas partes forem pagas 🎮</p>
      </div>
    </>
  );

  if (phase === 'card' && pixId) {
    return (
      <>
        <div className="split-paid-note" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Pix de R$ {formatPriceBR(pixPart)} pago.</strong> Agora falta R$ {formatPriceBR(cardPart)} no cartão.
            <small>Se precisar sair, é só abrir este jogo de novo pra terminar.</small>
          </div>
        </div>
        <CardPaymentStep
          gameId={gameId}
          email={email}
          loggedIn={loggedIn}
          splitPixId={pixId}
          onReadyChange={onReadyChange}
          referralSource={referralSource}
          setReferralSource={setReferralSource}
          onBack={onBack}
          onConfirmed={() => {
            forgetSplitPix(gameId);
            onConfirmed();
          }}
        />
      </>
    );
  }

  if (phase === 'pix' && pix) {
    return (
      <PaymentLayout side={side}>
        <p className="split-step-label">Parte 1 de 2 · Pix</p>
        <p className="purchase-pix-amount">R$ {formatPriceBR(pix.amount)}</p>
        {pix.feePercent > 0 && (
          <p className="card-payment-fee-note">
            Valor inclui a taxa de processamento do Pix ({formatPriceBR(pix.feePercent)}%).
          </p>
        )}
        <p className="split-next-hint">Depois que o Pix cair, você paga R$ {formatPriceBR(cardPart)} no cartão aqui mesmo.</p>

        <ReservationTimer />

        <div className="purchase-pix-qr-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pix.qrCodeImage} alt="QR Code Pix para pagamento" />
        </div>

        <label className="purchase-pix-copy-label" htmlFor="split-pix-copia-cola">
          Pix Copia e Cola
        </label>
        <div className="purchase-pix-copy-row">
          <input id="split-pix-copia-cola" type="text" readOnly value={pix.brCode} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn ghost" onClick={handleCopy}>
            Copiar
          </button>
        </div>
        {copied && <p className="purchase-copy-feedback">✓ Código copiado!</p>}

        <PixAutoStatus
          status={pixStatus}
          onBack={() => {
            if (pixStatus === 'failed') forgetSplitPix(gameId);
            setPhase('choose');
            setPix(null);
            setPixId(null);
          }}
          pendingText="Aguardando o Pix — assim que cair, essa tela abre o cartão sozinha."
        />
      </PaymentLayout>
    );
  }

  return (
    <PaymentLayout side={side}>
      <p className="split-step-label">Quanto você quer pagar no Pix?</p>
      <div className="split-amount-row">
        <span className="split-amount-prefix">R$</span>
        <input
          className="split-amount-input"
          type="text"
          inputMode="decimal"
          value={pixText}
          onChange={(e) => setPixText(e.target.value.replace(/[^\d.,]/g, ''))}
          aria-label="Valor no Pix"
        />
      </div>
      <input
        className="split-amount-range"
        type="range"
        min={MIN_PART}
        max={maxPart}
        step={1}
        value={valid ? typed : Math.min(Math.max(Number.isFinite(typed) ? typed : MIN_PART, MIN_PART), maxPart)}
        onChange={(e) => setPixText(formatPriceBR(Number(e.target.value)))}
        aria-label="Arraste para dividir entre Pix e cartão"
      />

      <div className="split-summary">
        <div>
          <span>No Pix</span>
          <strong>{valid ? `R$ ${formatPriceBR(typed)}` : '—'}</strong>
        </div>
        <div>
          <span>No cartão</span>
          <strong>{rest !== null ? `R$ ${formatPriceBR(rest)}` : '—'}</strong>
        </div>
      </div>
      {!valid && (
        <p className="card-payment-error" role="alert">
          Escolha um valor entre R$ {formatPriceBR(MIN_PART)} e R$ {formatPriceBR(maxPart)} pro Pix.
        </p>
      )}
      <p className="card-payment-fee-note">
        Primeiro você paga o Pix; depois, o resto no cartão (em até 12x). A taxa do cartão vale só sobre a parte do
        cartão.
      </p>
      {error && (
        <p className="card-payment-error" role="alert">
          {error}
        </p>
      )}

      <div className="purchase-modal-actions">
        <button type="button" className="btn primary product-cta" onClick={handleStart} disabled={!valid || starting}>
          {starting ? 'Gerando o Pix...' : valid ? `Gerar Pix de R$ ${formatPriceBR(typed)}` : 'Gerar Pix'}
        </button>
        <button type="button" className="purchase-step-back" onClick={onBack} disabled={starting}>
          ← Voltar
        </button>
      </div>
    </PaymentLayout>
  );
}
