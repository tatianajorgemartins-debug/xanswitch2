import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Criado só na primeira consulta, não quando este arquivo é importado — assim,
// nada quebra em ambientes que importam este módulo sem nunca chamar
// nenhuma função dele mas também não têm DATABASE_URL configurada.
let sqlInstance: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
  if (!sqlInstance) {
    sqlInstance = neon(process.env.DATABASE_URL!);
  }
  return sqlInstance;
}

export type Platform = 'switch1' | 'switch2' | 'both';
export type GameType = 'base' | 'dlc' | 'update';

export type Game = {
  id: number;
  name: string;
  price: string; // numeric comes back as string from postgres
  original_price: string | null;
  image_url: string | null;
  // Imagem separada só pros banners largos (Destaque da semana / Mais
  // aguardados) — se estiver vazia, esses banners caem de volta pra
  // image_url (a capa quadrada normal), esticada/cortada pra caber.
  banner_image_url: string | null;
  has_badge: boolean;
  badge_text: string;
  badge_color: string;
  franchise: string | null;
  platform: Platform;
  game_type: GameType;
  is_featured: boolean;
  is_bestseller: boolean;
  is_upcoming: boolean;
  archived: boolean;
  description: string | null;
  screenshots: string[]; // guardado como JSONB — o driver já devolve como array pronto
  // Link de pagamento parcelado (crédito) configurado manualmente no admin,
  // pra jogos onde você quer oferecer essa opção além do Pix à vista —
  // ver StepSummary em app/PurchaseModal.tsx.
  credit_payment_url: string | null;
  created_at: Date; // timestamptz comes back as a real Date, not a string
  updated_at: Date;
};

// Esta é a consulta que roda no catálogo PÚBLICO (a página que os clientes
// veem). Antigamente ela era embrulhada com unstable_cache (o cache "por
// dentro" da função) — mas na prática, nesta versão do Next.js rodando na
// Vercel, a invalidação desse cache (via revalidateTag) não estava
// respondendo de forma confiável: uma alteração no admin podia não
// aparecer pro público nem depois de vários minutos, mesmo chamando
// revalidateTag corretamente. Então essa função voltou a ser simples (sem
// cache próprio) — quem cuida de não bater no banco a cada visita agora é
// só o cache da PÁGINA em si (o "export const revalidate" em
// app/page.tsx), que testamos e confirmamos que responde direito a
// revalidatePath('/') nas ações do admin.
export async function getActiveGames(): Promise<Game[]> {
  const rows = await getSql()`
    SELECT * FROM games WHERE archived = FALSE ORDER BY sort_name ASC
  `;
  return rows as Game[];
}

export async function getAllGames(): Promise<Game[]> {
  const rows = await getSql()`
    SELECT * FROM games ORDER BY archived ASC, sort_name ASC
  `;
  return rows as Game[];
}

export async function getGameById(id: number): Promise<Game | null> {
  const rows = await getSql()`SELECT * FROM games WHERE id = ${id}`;
  return (rows[0] as Game) ?? null;
}

export async function createGame(data: {
  name: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  banner_image_url: string | null;
  has_badge: boolean;
  badge_text: string;
  badge_color: string;
  franchise: string | null;
  platform: Platform;
  game_type: GameType;
  is_featured: boolean;
  is_bestseller: boolean;
  is_upcoming: boolean;
  description: string | null;
  screenshots: string[];
  credit_payment_url: string | null;
}): Promise<Game> {
  const rows = await getSql()`
    INSERT INTO games (name, price, original_price, image_url, banner_image_url, has_badge, badge_text, badge_color, franchise, platform, game_type, is_featured, is_bestseller, is_upcoming, description, screenshots, credit_payment_url)
    VALUES (${data.name}, ${data.price}, ${data.original_price}, ${data.image_url}, ${data.banner_image_url}, ${data.has_badge}, ${data.badge_text}, ${data.badge_color}, ${data.franchise}, ${data.platform}, ${data.game_type}, ${data.is_featured}, ${data.is_bestseller}, ${data.is_upcoming}, ${data.description}, ${JSON.stringify(data.screenshots)}::jsonb, ${data.credit_payment_url})
    RETURNING *
  `;
  return rows[0] as Game;
}

export async function updateGame(
  id: number,
  data: {
    name: string;
    price: number;
    original_price: number | null;
    image_url: string | null;
    banner_image_url: string | null;
    has_badge: boolean;
    badge_text: string;
    badge_color: string;
    franchise: string | null;
    platform: Platform;
    game_type: GameType;
    is_featured: boolean;
    is_bestseller: boolean;
    is_upcoming: boolean;
    description: string | null;
    screenshots: string[];
    credit_payment_url: string | null;
  }
): Promise<Game> {
  const rows = await getSql()`
    UPDATE games SET
      name = ${data.name},
      price = ${data.price},
      original_price = ${data.original_price},
      image_url = ${data.image_url},
      banner_image_url = ${data.banner_image_url},
      has_badge = ${data.has_badge},
      badge_text = ${data.badge_text},
      badge_color = ${data.badge_color},
      franchise = ${data.franchise},
      platform = ${data.platform},
      game_type = ${data.game_type},
      is_featured = ${data.is_featured},
      is_bestseller = ${data.is_bestseller},
      is_upcoming = ${data.is_upcoming},
      description = ${data.description},
      screenshots = ${JSON.stringify(data.screenshots)}::jsonb,
      credit_payment_url = ${data.credit_payment_url},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] as Game;
}

export async function setArchived(id: number, archived: boolean): Promise<void> {
  await getSql()`UPDATE games SET archived = ${archived}, updated_at = now() WHERE id = ${id}`;
}

export async function deleteGame(id: number): Promise<void> {
  await getSql()`DELETE FROM games WHERE id = ${id}`;
}

export async function getVisitCount(): Promise<number> {
  const rows = await getSql()`SELECT value FROM site_settings WHERE key = 'visit_count'`;
  return rows[0]?.value ? parseInt(rows[0].value as string, 10) : 0;
}

// Atomic increment (avoids losing counts if two visitors land at the same
// instant) — the whole read-modify-write happens inside Postgres.
export async function incrementVisitCount(): Promise<void> {
  await getSql()`
    INSERT INTO site_settings (key, value) VALUES ('visit_count', '1')
    ON CONFLICT (key) DO UPDATE SET value = (COALESCE(site_settings.value, '0')::int + 1)::text
  `;
}

export type Review = {
  id: number;
  name: string;
  instagram: string | null;
  rating: number;
  comment: string;
  approved: boolean;
  is_featured: boolean;
  created_at: Date;
};

// Mesma lógica de getActiveGames acima — esta é a consulta usada no
// catálogo público, sem cache próprio (só o cache da página cuida disso).
export async function getApprovedReviews(): Promise<Review[]> {
  const rows = await getSql()`
    SELECT * FROM reviews WHERE approved = TRUE ORDER BY is_featured DESC, created_at DESC
  `;
  return rows as Review[];
}

export async function getAllReviews(): Promise<Review[]> {
  const rows = await getSql()`SELECT * FROM reviews ORDER BY approved ASC, created_at DESC`;
  return rows as Review[];
}

export async function createReview(data: {
  name: string;
  instagram: string | null;
  rating: number;
  comment: string;
}): Promise<Review> {
  const rows = await getSql()`
    INSERT INTO reviews (name, instagram, rating, comment)
    VALUES (${data.name}, ${data.instagram}, ${data.rating}, ${data.comment})
    RETURNING *
  `;
  return rows[0] as Review;
}

export async function setReviewApproved(id: number, approved: boolean): Promise<void> {
  await getSql()`UPDATE reviews SET approved = ${approved} WHERE id = ${id}`;
}

export async function setReviewFeatured(id: number, featured: boolean): Promise<void> {
  await getSql()`UPDATE reviews SET is_featured = ${featured} WHERE id = ${id}`;
}

export async function deleteReview(id: number): Promise<void> {
  await getSql()`DELETE FROM reviews WHERE id = ${id}`;
}

// Pedidos: um registro é criado quando o cliente clica em "Já paguei —
// confirmar pedido" no fluxo Pix, ou em "Continuar pro pagamento" no fluxo
// de crédito parcelado (ver confirmOrderAction e logCreditLinkClickAction
// em app/orderActions.ts). Como não existe gateway de pagamento, isso é
// uma declaração/intenção do próprio cliente — não uma confirmação
// automática de que o dinheiro realmente caiu na conta. status guarda em
// que pé está o atendimento (por padrão 'aguardando_codigo': pagamento
// declarado, código ainda não enviado). payment_method diferencia os dois
// caminhos — o de crédito não tem e-mail, já que essa etapa não existe
// nesse fluxo (o pagamento em si acontece num link externo).
export type Order = {
  id: number;
  game_id: number | null;
  game_name: string;
  price: string; // numeric comes back as string from postgres
  customer_email: string | null;
  status: string;
  // Resposta opcional de "como você conheceu a loja?", marcada na tela de
  // pagamento — null quando o cliente não respondeu.
  referral_source: string | null;
  payment_method: string;
  created_at: Date;
};

export async function createOrder(data: {
  game_id: number | null;
  game_name: string;
  price: number;
  customer_email: string | null;
  referral_source: string | null;
  payment_method: string;
}): Promise<Order> {
  const rows = await getSql()`
    INSERT INTO orders (game_id, game_name, price, customer_email, referral_source, payment_method)
    VALUES (${data.game_id}, ${data.game_name}, ${data.price}, ${data.customer_email}, ${data.referral_source}, ${data.payment_method})
    RETURNING *
  `;
  return rows[0] as Order;
}

export async function getRecentOrders(limit = 100): Promise<Order[]> {
  const rows = await getSql()`
    SELECT * FROM orders ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows as Order[];
}

export async function deleteOrder(id: number): Promise<void> {
  await getSql()`DELETE FROM orders WHERE id = ${id}`;
}
