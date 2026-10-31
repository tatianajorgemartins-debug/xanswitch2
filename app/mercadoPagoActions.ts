'use server';

// Pix e cartão pelo Mercado Pago — as ações que a tela de pagamento usa
// (PurchaseModal.tsx, BulkPurchaseModal.tsx e CardPaymentStep.tsx):
//
// 1. startPixPaymentAction / startBulkPixPaymentAction: cria a cobrança no
//    Mercado Pago e devolve o QR Code. O valor é calculado AQUI, a partir
//    do banco (preço, promoção, desconto de fidelidade) — nunca a partir do
//    preço que o navegador mandou.
// 2. checkPixPaymentAction: a tela chama a cada poucos segundos; quando o
//    Pix cai, o pedido é criado (ver lib/mercadoPagoOrders.ts) e a tela
//    avança sozinha pro card — sem o "Já paguei".
// 3. payWithCardAction: cobra no cartão com o "token" que o formulário do
//    Mercado Pago gerou no navegador; a resposta já vem decidida na hora.
//
// 4. Pix + cartão (startSplitPixPaymentAction → payWithCardAction com
//    splitPixId): uma parte do jogo no Pix e o resto no cartão. O Pix vem
//    primeiro; depois que ele cai, a mesma tela abre o cartão com o resto.
//
// Sem MP_ACCESS_TOKEN configurado, as ações de início devolvem
// { mode: 'static' } e a tela segue no Pix de sempre (lib/pix.ts).
import { randomUUID } from 'crypto';
import {
  getAvailableDiscountCredit,
  getGameById,
  getMpPaymentRecord,
  getValidPrivateOffer,
  createMpPaymentRecord,
  setMpPaymentReferralSource,
  type Game,
  type MpPaymentItem,
  type MpPaymentRecord
} from '@/lib/db';
import {
  createCardPayment,
  createPixPayment,
  getPixPaymentState,
  deleteCustomerCard,
  findCustomerId,
  findOrCreateCustomerId,
  isMercadoPagoEnabled,
  listCustomerCards,
  saveCustomerCard,
  type CardInput,
  type SavedCard
} from '@/lib/mercadoPago';
import { syncMercadoPagoPayment, type PixCheckStatus } from '@/lib/mercadoPagoOrders';
import { gamePrice, priceWithFee } from '@/lib/gamePrice';
import { getPaymentFees } from '@/lib/paymentFees';
import { isValidEmail, isValidReferralSource } from '@/lib/validation';
import { verifyAccessToken } from '@/lib/supabaseAuthServer';

export type StartPixResult =
  | { mode: 'static' }
  // amount: o valor cobrado de fato (com a taxa do Pix repassada, se houver
  // — ver lib/paymentFees.ts); feePercent > 0 faz a tela avisar o cliente.
  | { mode: 'mercadopago'; paymentId: string; brCode: string; qrCodeImage: string; amount: number; feePercent: number }
  | { mode: 'error'; error: string };

const GENERIC_ERROR = 'Não foi possível gerar o Pix agora. Tente de novo em instantes.';

async function loadGame(gameId: number): Promise<Game | null> {
  const game = await getGameById(gameId).catch(() => null);
  return game && !game.archived ? game : null;
}

// Link exclusivo (admin → 🔗 Links exclusivos): o preço especial vem do
// banco, pelo token — nunca do navegador. Token inválido, vencido, de outro
// jogo ou já usado até o limite = erro (não cai no preço normal escondido).
async function loadOffer(offerToken: string | null | undefined, gameId: number): Promise<{ token: string; price: number } | null | 'invalid'> {
  if (!offerToken) return null;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(offerToken)) return 'invalid';
  const offer = await getValidPrivateOffer(offerToken).catch(() => null);
  if (!offer || offer.game_id !== gameId) return 'invalid';
  return { token: offer.token, price: parseFloat(offer.price) };
}
const OFFER_ERROR = 'Esse link exclusivo não vale mais (venceu ou já foi usado). Fale com a gente no WhatsApp.';

function gameToPaymentItem(game: Game, offer: { token: string; price: number } | null = null): MpPaymentItem {
  return {
    gameId: game.id,
    gameName: game.name,
    price: offer ? offer.price : gamePrice(game).price,
    offerToken: offer?.token ?? null,
    discountApplied: 0,
    cardPoints: game.card_points,
    cardImageUrl: game.image_url,
    amazonJpUrl: game.amazon_jp_url
  };
}

async function createCharge(
  items: MpPaymentItem[],
  email: string,
  discountCreditId: number | null
): Promise<StartPixResult> {
  const subtotal = Math.round(items.reduce((sum, it) => sum + it.price, 0) * 100) / 100;
  // Desconto cobrindo o jogo inteiro (ou valor quebrado demais pra cobrar):
  // não tem o que cobrar no Mercado Pago, segue o caminho de sempre.
  if (subtotal < 1) return { mode: 'static' };

  try {
    // Os pedidos guardam o preço do jogo (o que você recebe); a cobrança
    // leva a taxa do Pix repassada, se configurada no admin.
    const { pix: feePercent } = await getPaymentFees();
    const total = priceWithFee(subtotal, feePercent);
    const charge = await createPixPayment({
      amount: total,
      payerEmail: email,
      externalReference: randomUUID()
    });
    await createMpPaymentRecord({
      id: charge.id,
      total,
      customer_email: email,
      discount_credit_id: discountCreditId,
      items,
      payment_method: 'pix'
    });
    return {
      mode: 'mercadopago',
      paymentId: charge.id,
      brCode: charge.qrCode,
      qrCodeImage: `data:image/png;base64,${charge.qrCodeBase64}`,
      amount: total,
      feePercent
    };
  } catch (err) {
    console.error('[mercadopago] Falha ao criar Pix:', err);
    return { mode: 'error', error: GENERIC_ERROR };
  }
}

// Um jogo só. applyDiscount + accessToken: mesma conferência do
// confirmOrderAction (app/orderActions.ts) — o desconto de fidelidade só
// vale se o token for válido, for do mesmo e-mail e existir crédito.
export async function startPixPaymentAction(
  gameId: number,
  email: string,
  applyDiscount: boolean,
  accessToken: string | null,
  offerToken: string | null = null
): Promise<StartPixResult> {
  if (!isMercadoPagoEnabled()) return { mode: 'static' };
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) return { mode: 'error', error: 'Digite um e-mail válido.' };

  const game = await loadGame(gameId);
  if (!game) return { mode: 'error', error: 'Esse jogo não está mais disponível.' };
  const offer = await loadOffer(offerToken, gameId);
  if (offer === 'invalid') return { mode: 'error', error: OFFER_ERROR };
  const item = gameToPaymentItem(game, offer);

  // Link exclusivo já é o preço especial: sem desconto de fidelidade junto.
  let discountCreditId: number | null = null;
  if (applyDiscount && game.discount_eligible && !offer) {
    const verifiedEmail = await verifyAccessToken(accessToken);
    if (verifiedEmail && verifiedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
      const credit = await getAvailableDiscountCredit(verifiedEmail);
      if (credit) {
        item.discountApplied = Math.min(item.price, parseFloat(credit.amount));
        item.price = Math.max(0, item.price - item.discountApplied);
        discountCreditId = credit.id;
      }
    }
  }

  return createCharge([item], trimmedEmail, discountCreditId);
}

// Vários jogos da lista de desejos num Pix só (BulkPurchaseModal.tsx). Sem
// desconto de fidelidade, igual ao confirmBulkOrderAction.
export async function startBulkPixPaymentAction(gameIds: number[], email: string): Promise<StartPixResult> {
  if (!isMercadoPagoEnabled()) return { mode: 'static' };
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) return { mode: 'error', error: 'Digite um e-mail válido.' };

  const games = await Promise.all(gameIds.map(loadGame));
  if (games.length === 0 || games.some((g) => !g)) {
    return { mode: 'error', error: 'Algum desses jogos não está mais disponível. Volte e confira a lista.' };
  }
  const items = (games as Game[]).map((g) => gameToPaymentItem(g));

  return createCharge(items, trimmedEmail, null);
}

// --- Pix + cartão ---

// Menor valor de cada parte (Pix e cartão), em reais do preço do jogo.
const SPLIT_MIN_PART = 5;

// Começa o Pix + cartão: cria só o Pix, com a parte que o cliente escolheu
// (pixPart, em reais do preço do jogo). O resto (preço - pixPart) vai pro
// cartão depois que o Pix cair. Sem desconto de fidelidade, igual ao cartão.
export async function startSplitPixPaymentAction(
  gameId: number,
  email: string,
  pixPart: number,
  offerToken: string | null = null
): Promise<StartPixResult> {
  if (!isMercadoPagoEnabled()) return { mode: 'error', error: 'Pix + cartão indisponível no momento.' };
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) return { mode: 'error', error: 'Digite um e-mail válido.' };

  const game = await loadGame(gameId);
  if (!game) return { mode: 'error', error: 'Esse jogo não está mais disponível.' };
  const offer = await loadOffer(offerToken, gameId);
  if (offer === 'invalid') return { mode: 'error', error: OFFER_ERROR };
  const item = gameToPaymentItem(game, offer);
  const part = Math.round(pixPart * 100) / 100;
  if (!Number.isFinite(part) || part < SPLIT_MIN_PART || part > item.price - SPLIT_MIN_PART) {
    return { mode: 'error', error: `Cada parte precisa ser de pelo menos R$ ${SPLIT_MIN_PART},00.` };
  }

  try {
    const { pix: feePercent } = await getPaymentFees();
    const total = priceWithFee(part, feePercent);
    const charge = await createPixPayment({ amount: total, payerEmail: trimmedEmail, externalReference: randomUUID() });
    await createMpPaymentRecord({
      id: charge.id,
      total,
      customer_email: trimmedEmail,
      discount_credit_id: null,
      items: [item],
      payment_method: 'pix+cartao',
      split_pix_part: part
    });
    return {
      mode: 'mercadopago',
      paymentId: charge.id,
      brCode: charge.qrCode,
      qrCodeImage: `data:image/png;base64,${charge.qrCodeBase64}`,
      amount: total,
      feePercent
    };
  } catch (err) {
    console.error('[mercadopago] Falha ao criar Pix (Pix + cartão):', err);
    return { mode: 'error', error: GENERIC_ERROR };
  }
}

// Confere a cobrança do Pix de um Pix + cartão antes de cobrar o resto no
// cartão: tem que ser desse jogo, estar paga e ainda não ter sido
// completada. Devolve o registro e quanto do preço falta (vai pro cartão).
async function loadPaidSplitPix(
  splitPixId: string,
  gameId: number
): Promise<{ record: MpPaymentRecord; cardPart: number } | { error: string }> {
  if (!/^[A-Za-z0-9]+$/.test(splitPixId)) return { error: 'Pagamento não encontrado.' };
  const record = await getMpPaymentRecord(splitPixId);
  if (!record || record.split_pix_part === null || record.items[0]?.gameId !== gameId) {
    return { error: 'Pagamento não encontrado.' };
  }
  if (record.processed_at) return { error: 'Esse jogo já foi pago por completo.' };
  const state = await getPixPaymentState(splitPixId);
  if (state.status !== 'approved') return { error: 'O Pix dessa compra ainda não caiu.' };
  const price = record.items.reduce((sum, it) => sum + it.price, 0);
  return { record, cardPart: Math.round((price - parseFloat(record.split_pix_part)) * 100) / 100 };
}

// Pra retomar um Pix + cartão (a pessoa fechou a janela depois de pagar o
// Pix e abriu o jogo de novo): diz se o Pix já caiu e quanto falta.
export async function getSplitStatusAction(
  splitPixId: string,
  gameId: number
): Promise<{ status: 'paid'; pixPart: number; cardPart: number } | { status: 'none' }> {
  try {
    const paid = await loadPaidSplitPix(splitPixId, gameId);
    if ('error' in paid) return { status: 'none' };
    return { status: 'paid', pixPart: parseFloat(paid.record.split_pix_part as string), cardPart: paid.cardPart };
  } catch {
    return { status: 'none' };
  }
}

// referralSource vai junto porque o "como você conheceu a loja?" é marcado
// na própria tela do Pix, depois que a cobrança já existe.
export async function checkPixPaymentAction(paymentId: string, referralSource: string | null): Promise<PixCheckStatus> {
  // Ids das cobranças do Mercado Pago são letras e números ("ORD01...").
  if (!/^[A-Za-z0-9]+$/.test(paymentId)) return 'failed';
  try {
    await setMpPaymentReferralSource(paymentId, referralSource && isValidReferralSource(referralSource) ? referralSource : null);
    return await syncMercadoPagoPayment(paymentId);
  } catch (err) {
    // Falha passageira (rede, Mercado Pago lento): a tela tenta de novo na
    // próxima consulta.
    console.error('[mercadopago] Falha ao consultar pagamento:', err);
    return 'pending';
  }
}

export type CardPaymentResult =
  // cardSaved: a caixinha "Salvar cartão" estava marcada e deu certo.
  | { status: 'approved'; cardSaved: boolean }
  // Em análise pelo antifraude do Mercado Pago: a tela fica esperando
  // (mesma consulta do Pix — checkPixPaymentAction) até sair a decisão.
  | { status: 'pending'; paymentId: string }
  | { status: 'rejected'; error: string };

// Explica a recusa em português, pelo motivo que o Mercado Pago devolve.
function cardRejectionMessage(statusDetail: string): string {
  const detail = statusDetail.toLowerCase();
  if (detail.includes('insufficient')) return 'Cartão recusado por limite insuficiente. Tente outro cartão ou pague com Pix.';
  if (detail.includes('security_code')) return 'O código de segurança (CVV) não confere. Confira e tente de novo.';
  if (detail.includes('expiration') || detail.includes('date')) return 'A data de validade não confere. Confira e tente de novo.';
  if (detail.includes('call_for_authorize') || detail.includes('authorize'))
    return 'O banco pediu autorização pra essa compra. Libere no app do seu banco e tente de novo.';
  if (detail.includes('risk') || detail.includes('fraud') || detail.includes('blacklist'))
    return 'O pagamento não foi aprovado pela análise de segurança. Tente outro cartão ou pague com Pix.';
  return 'O cartão foi recusado. Confira os dados, tente outro cartão ou pague com Pix.';
}

// Quanto o jogo sai no cartão (com a taxa repassada — ver
// lib/paymentFees.ts) e no Pix, pra tela mostrar antes de o cliente
// digitar o cartão. O formulário do Mercado Pago calcula as parcelas em
// cima desse valor.
// splitPixId: no Pix + cartão, só o que falta depois do Pix.
export async function getCardChargeAction(
  gameId: number,
  splitPixId: string | null = null,
  offerToken: string | null = null
): Promise<{ amount: number; feePercent: number; pixAmount: number } | null> {
  let price: number;
  if (splitPixId) {
    const paid = await loadPaidSplitPix(splitPixId, gameId).catch(() => null);
    if (!paid || 'error' in paid) return null;
    price = paid.cardPart;
  } else {
    const game = await loadGame(gameId);
    if (!game) return null;
    const offer = await loadOffer(offerToken, gameId);
    if (offer === 'invalid') return null;
    price = offer ? offer.price : gamePrice(game).price;
  }
  const fees = await getPaymentFees();
  return { amount: priceWithFee(price, fees.card), feePercent: fees.card, pixAmount: priceWithFee(price, fees.pix) };
}

// --- Cartões salvos (ver "Cartões salvos" em lib/mercadoPago.ts) ---
// Tudo aqui exige o token de login da conta XAN Switch (Supabase), conferido
// no servidor: os cartões de uma pessoa só aparecem pra ela mesma — nunca
// pra quem só souber o e-mail.

export async function getSavedCardsAction(accessToken: string | null): Promise<SavedCard[]> {
  if (!isMercadoPagoEnabled()) return [];
  const email = await verifyAccessToken(accessToken);
  if (!email) return [];
  try {
    const customerId = await findCustomerId(email);
    return customerId ? await listCustomerCards(customerId) : [];
  } catch (err) {
    console.error('[mercadopago] Falha ao listar cartões salvos:', err);
    return [];
  }
}

export async function deleteSavedCardAction(accessToken: string | null, cardId: string): Promise<{ ok: boolean }> {
  const email = await verifyAccessToken(accessToken);
  if (!email || !/^[A-Za-z0-9]+$/.test(cardId)) return { ok: false };
  try {
    const customerId = await findCustomerId(email);
    if (!customerId) return { ok: false };
    // Só apaga se o cartão for mesmo dessa pessoa.
    const cards = await listCustomerCards(customerId);
    if (!cards.some((c) => c.id === cardId)) return { ok: false };
    await deleteCustomerCard(customerId, cardId);
    return { ok: true };
  } catch (err) {
    console.error('[mercadopago] Falha ao remover cartão salvo:', err);
    return { ok: false };
  }
}

// Cobra um jogo no cartão. O valor vem do banco (sem desconto de
// fidelidade — o desconto continua valendo só no Pix), com a taxa do
// cartão repassada. Aprovado, o pedido é criado na hora, com os pontos já
// confirmados, igual ao Pix.
//
// options (só pra quem está logado — o accessToken é conferido aqui):
// - savedCardId: pagando com um cartão salvo (o token veio do cartão
//   salvo + CVV). A Orders API exige o customer_id junto.
// - saveCard: cartão novo + caixinha "Salvar cartão" marcada — depois de
//   aprovado, guarda o cartão no Mercado Pago com o mesmo token.
export async function payWithCardAction(
  gameId: number,
  email: string,
  card: CardInput,
  referralSource: string | null,
  options: { accessToken: string | null; savedCardId: string | null; saveCard: boolean; splitPixId?: string | null; offerToken?: string | null } = {
    accessToken: null,
    savedCardId: null,
    saveCard: false
  }
): Promise<CardPaymentResult> {
  if (!isMercadoPagoEnabled()) return { status: 'rejected', error: 'Pagamento com cartão indisponível no momento.' };
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) return { status: 'rejected', error: 'Digite um e-mail válido.' };

  const game = await loadGame(gameId);
  if (!game) return { status: 'rejected', error: 'Esse jogo não está mais disponível.' };
  const offer = options.splitPixId ? null : await loadOffer(options.offerToken, gameId);
  if (offer === 'invalid') return { status: 'rejected', error: OFFER_ERROR };
  const item = gameToPaymentItem(game, offer);

  // Pix + cartão: cobra só o que falta depois do Pix já pago.
  let splitPixId: string | null = null;
  if (options.splitPixId) {
    const paid = await loadPaidSplitPix(options.splitPixId, gameId).catch(() => null);
    if (!paid) return { status: 'rejected', error: 'Não foi possível conferir o Pix agora. Tente de novo em instantes.' };
    if ('error' in paid) return { status: 'rejected', error: paid.error };
    item.price = paid.cardPart;
    splitPixId = paid.record.id;
  }

  const accountEmail =
    options.savedCardId || options.saveCard ? await verifyAccessToken(options.accessToken) : null;

  try {
    let customerId: string | undefined;
    if (options.savedCardId) {
      if (!accountEmail) return { status: 'rejected', error: 'Entre na sua conta de novo pra usar o cartão salvo.' };
      const found = await findCustomerId(accountEmail);
      const cards = found ? await listCustomerCards(found) : [];
      if (!found || !cards.some((c) => c.id === options.savedCardId)) {
        return { status: 'rejected', error: 'Esse cartão salvo não está mais disponível. Use outro cartão.' };
      }
      customerId = found;
    }

    // Pedido guarda o preço do jogo (o que você recebe); a cobrança leva a
    // taxa do cartão repassada.
    const total = priceWithFee(item.price, (await getPaymentFees()).card);
    const charge = await createCardPayment({
      amount: total,
      payerEmail: accountEmail ?? trimmedEmail,
      externalReference: randomUUID(),
      card,
      customerId
    });
    if (charge.state.status === 'failed' || !charge.id) {
      return { status: 'rejected', error: cardRejectionMessage(charge.statusDetail) };
    }

    const referral = referralSource && isValidReferralSource(referralSource) ? referralSource : null;
    if (splitPixId) {
      // O jogo e os preços ficam na cobrança do Pix; esta só completa ela.
      await setMpPaymentReferralSource(splitPixId, referral);
      await createMpPaymentRecord({
        id: charge.id,
        total,
        customer_email: trimmedEmail,
        discount_credit_id: null,
        items: [],
        payment_method: 'pix+cartao',
        referral_source: referral,
        split_pix_id: splitPixId
      });
    } else {
      await createMpPaymentRecord({
        id: charge.id,
        total,
        customer_email: trimmedEmail,
        discount_credit_id: null,
        items: [item],
        payment_method: 'cartao',
        referral_source: referral
      });
    }

    if (charge.state.status === 'approved') {
      // Cria o pedido agora (o aviso do Mercado Pago pode chegar depois;
      // se chegar, encontra tudo já feito e não duplica).
      const synced = await syncMercadoPagoPayment(charge.id).catch(() => 'approved' as const);
      if (synced === 'approved') {
        // Guardar o cartão é um extra: se falhar, a compra continua valendo.
        let cardSaved = false;
        if (options.saveCard && !options.savedCardId && accountEmail) {
          try {
            await saveCustomerCard(await findOrCreateCustomerId(accountEmail), card.token);
            cardSaved = true;
          } catch (err) {
            console.error('[mercadopago] Falha ao salvar o cartão:', err);
          }
        }
        return { status: 'approved', cardSaved };
      }
    }
    return { status: 'pending', paymentId: charge.id };
  } catch (err) {
    console.error('[mercadopago] Falha ao cobrar no cartão:', err);
    return { status: 'rejected', error: 'Não foi possível processar o cartão agora. Tente de novo em instantes ou pague com Pix.' };
  }
}
