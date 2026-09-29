'use server';

// Busca os cards colecionáveis e o total de pontos de quem está logado —
// usado pela seção "🎴 Minha coleção" dentro do popup de conta (ver
// AccountModal.tsx).
//
// Por que recebe um "token" em vez de só confiar num e-mail que o navegador
// manda: uma Server Action roda no servidor, sem acesso direto à sessão do
// Supabase (essa sessão vive só no navegador — este projeto não usa
// cookies de sessão do lado do servidor, veja lib/supabaseBrowser.ts). Se
// essa função aceitasse só um e-mail solto como parâmetro, qualquer pessoa
// poderia chamá-la fingindo ser outro cliente e ver os cards dela. Em vez
// disso, o navegador manda o "access token" da sessão atual (ver
// getAccessToken em lib/wishlist.ts), e aqui a gente pede pro próprio
// Supabase confirmar de quem é esse token — só depois disso confiamos no
// e-mail que ele devolve.
import { getOrdersByEmail, type Order } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

export type CardSummary = {
  orderId: number;
  gameName: string;
  imageUrl: string | null;
  points: number;
  confirmed: boolean;
  purchasedAt: string;
};

export type MyCardsResult =
  | { ok: true; cards: CardSummary[]; totalPoints: number; pendingPoints: number }
  | { ok: false; error: string };

function toCardSummary(order: Order): CardSummary {
  return {
    orderId: order.id,
    gameName: order.game_name,
    imageUrl: order.card_image_url,
    points: order.card_points_earned,
    confirmed: order.card_points_confirmed,
    purchasedAt: order.created_at.toString()
  };
}

export async function getMyCardsAction(accessToken: string): Promise<MyCardsResult> {
  if (!accessToken) {
    return { ok: false, error: 'Sessão inválida — entre de novo na sua conta.' };
  }

  // Client "cru" do Supabase, só com a chave pública (anon) — verificar um
  // token de acesso não precisa da chave secreta, só confirma que o token
  // foi mesmo emitido pelo Supabase e ainda é válido.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    return { ok: false, error: 'Sessão expirada — entre de novo na sua conta.' };
  }

  const orders = await getOrdersByEmail(data.user.email);
  const cards = orders.filter((o) => o.card_points_earned > 0).map(toCardSummary);
  const totalPoints = cards.filter((c) => c.confirmed).reduce((sum, c) => sum + c.points, 0);
  const pendingPoints = cards.filter((c) => !c.confirmed).reduce((sum, c) => sum + c.points, 0);

  return { ok: true, cards, totalPoints, pendingPoints };
}
