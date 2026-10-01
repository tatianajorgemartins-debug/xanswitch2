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
  // Quantos pontos o card colecionável desse jogo vale (1 a 5) — ver
  // CollectibleCard.tsx e a seção de gamificação do README.
  card_points: number;
  // Se marcado, o cliente pode usar um desconto de fidelidade (trocado por
  // pontos) na compra desse jogo — ver a seção "Troca de pontos por
  // desconto" do README.
  discount_eligible: boolean;
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
  card_points: number;
  discount_eligible: boolean;
}): Promise<Game> {
  const rows = await getSql()`
    INSERT INTO games (name, price, original_price, image_url, banner_image_url, has_badge, badge_text, badge_color, franchise, platform, game_type, is_featured, is_bestseller, is_upcoming, description, screenshots, credit_payment_url, card_points, discount_eligible)
    VALUES (${data.name}, ${data.price}, ${data.original_price}, ${data.image_url}, ${data.banner_image_url}, ${data.has_badge}, ${data.badge_text}, ${data.badge_color}, ${data.franchise}, ${data.platform}, ${data.game_type}, ${data.is_featured}, ${data.is_bestseller}, ${data.is_upcoming}, ${data.description}, ${JSON.stringify(data.screenshots)}::jsonb, ${data.credit_payment_url}, ${data.card_points}, ${data.discount_eligible})
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
    card_points: number;
    discount_eligible: boolean;
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
      card_points = ${data.card_points},
      discount_eligible = ${data.discount_eligible},
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

// Acesso genérico à tabela site_settings (chave/valor) — usado hoje pelo
// banner que substitui as avaliações na página principal (ver
// REVIEWS_BANNER_KEY em app/admin/actions.ts), mas serve pra qualquer
// configuração futura de "um valor só pro site inteiro", sem precisar de
// uma coluna nova pra cada uma.
export async function getSiteSetting(key: string): Promise<string | null> {
  const rows = await getSql()`SELECT value FROM site_settings WHERE key = ${key}`;
  return (rows[0]?.value as string | undefined) ?? null;
}

// Chave usada em site_settings pra guardar a URL do banner fino que
// substitui as avaliações na página principal (ver updateReviewsBannerAction
// em app/admin/actions.ts e como app/page.tsx / CatalogClient.tsx usam ela).
export const REVIEWS_BANNER_KEY = 'reviews_banner_image_url';

// Chave usada em site_settings pra guardar quantos reais valem os 5 pontos
// trocados por desconto (ver updateLoyaltyDiscountAmountAction em
// app/admin/actions.ts e getDiscountAmount em app/cardActions.ts). Só afeta
// créditos NOVOS gerados a partir da troca — um crédito já concedido guarda
// o valor de quando foi criado (discount_credits.amount), então mudar esse
// valor no admin nunca muda o valor de um desconto que o cliente já tem.
export const LOYALTY_DISCOUNT_AMOUNT_KEY = 'loyalty_discount_amount';

export async function setSiteSetting(key: string, value: string | null): Promise<void> {
  await getSql()`
    INSERT INTO site_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = ${value}
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
// de crédito parcelado (ver confirmOrderAction e confirmCreditOrderAction
// em app/orderActions.ts). Como não existe gateway de pagamento, isso é
// uma declaração/intenção do próprio cliente — não uma confirmação
// automática de que o dinheiro realmente caiu na conta. status guarda em
// que pé está o atendimento (por padrão 'aguardando_codigo': pagamento
// declarado, código ainda não enviado). payment_method só diferencia os
// dois caminhos pra fins de exibição no admin — os dois pedem e-mail e os
// dois premiam o card colecionável.
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
  // Card colecionável ganho nesse pedido (Pix ou crédito parcelado — ver
  // confirmOrderAction e confirmCreditOrderAction). card_points_earned e
  // card_image_url são uma "foto" dos dados do jogo no momento da compra,
  // pra o card não mudar se você editar o jogo depois. card_points_confirmed
  // começa falso e só vira true quando você confirma manualmente em
  // "🎖️ Clientes" — porque não existe gateway de pagamento pra confirmar
  // sozinho que o dinheiro realmente caiu na conta.
  card_points_earned: number;
  card_image_url: string | null;
  card_points_confirmed: boolean;
  // Quanto de desconto (R$) foi usado nesse pedido, trocado por pontos —
  // ver a seção "Troca de pontos por desconto" do README. Zero quando
  // nenhum desconto foi aplicado.
  discount_applied: string; // numeric comes back as string from postgres
  created_at: Date;
};

export async function createOrder(data: {
  game_id: number | null;
  game_name: string;
  price: number;
  customer_email: string | null;
  referral_source: string | null;
  payment_method: string;
  card_points_earned: number;
  card_image_url: string | null;
  discount_applied: number;
}): Promise<Order> {
  const rows = await getSql()`
    INSERT INTO orders (game_id, game_name, price, customer_email, referral_source, payment_method, card_points_earned, card_image_url, discount_applied)
    VALUES (${data.game_id}, ${data.game_name}, ${data.price}, ${data.customer_email}, ${data.referral_source}, ${data.payment_method}, ${data.card_points_earned}, ${data.card_image_url}, ${data.discount_applied})
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

// Todos os pedidos (Pix ou crédito parcelado) de um e-mail específico,
// usados pra montar "Minha coleção" (ver app/cardActions.ts). Comparação
// sem diferenciar maiúsculas/minúsculas, porque e-mail não é case-sensitive
// na prática.
export async function getOrdersByEmail(email: string): Promise<Order[]> {
  const rows = await getSql()`
    SELECT * FROM orders
    WHERE lower(customer_email) = lower(${email})
    ORDER BY created_at DESC
  `;
  return rows as Order[];
}

export async function deleteOrder(id: number): Promise<void> {
  await getSql()`DELETE FROM orders WHERE id = ${id}`;
}

// Confirma (ou desfaz a confirmação, se precisar corrigir um engano) os
// pontos de um pedido — chamada só pelo admin (ver confirmOrderPointsAction
// em app/admin/actions.ts), já que não existe outra forma de saber se o Pix
// realmente caiu na conta.
export async function setOrderCardPointsConfirmed(id: number, confirmed: boolean): Promise<void> {
  await getSql()`UPDATE orders SET card_points_confirmed = ${confirmed} WHERE id = ${id}`;
}

// --- Pontos e desconto de fidelidade ---
// (ver db/migration-loyalty-discounts.sql pra entender as tabelas)

export type PointAdjustment = {
  id: number;
  customer_email: string;
  points: number;
  note: string | null;
  created_at: Date;
};

// Ajuste manual de pontos — usado tanto por você no admin (correção,
// bônus) quanto pelo próprio sistema quando o cliente troca 5 pontos por
// um desconto (nesse caso `points` é negativo, ex: -5).
export async function createPointAdjustment(data: {
  customer_email: string;
  points: number;
  note: string | null;
}): Promise<PointAdjustment> {
  const rows = await getSql()`
    INSERT INTO point_adjustments (customer_email, points, note)
    VALUES (${data.customer_email}, ${data.points}, ${data.note})
    RETURNING *
  `;
  return rows[0] as PointAdjustment;
}

export async function getPointAdjustmentsByEmail(email: string): Promise<PointAdjustment[]> {
  const rows = await getSql()`
    SELECT * FROM point_adjustments WHERE lower(customer_email) = lower(${email}) ORDER BY created_at DESC
  `;
  return rows as PointAdjustment[];
}

// Soma de todos os ajustes manuais de um cliente (pode ser negativa) —
// usado no admin, em "🎖️ Clientes", pra somar ao total confirmado dos
// pedidos e chegar no total de pontos de verdade.
export async function getPointAdjustmentTotal(email: string): Promise<number> {
  const rows = await getSql()`
    SELECT COALESCE(SUM(points), 0)::int AS total FROM point_adjustments WHERE lower(customer_email) = lower(${email})
  `;
  return (rows[0]?.total as number) ?? 0;
}

// Soma de ajustes por cliente, de uma vez só — usado no admin em
// "🎖️ Clientes" pra somar ao total de cada um sem uma consulta por cliente.
export async function getAllPointAdjustmentTotals(): Promise<Record<string, number>> {
  const rows = await getSql()`
    SELECT lower(customer_email) AS email, COALESCE(SUM(points), 0)::int AS total
    FROM point_adjustments
    GROUP BY lower(customer_email)
  `;
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.email as string] = row.total as number;
  }
  return result;
}

export type DiscountCredit = {
  id: number;
  customer_email: string;
  amount: string; // numeric comes back as string from postgres
  status: string;
  used_order_id: number | null;
  created_at: Date;
  used_at: Date | null;
};

export async function createDiscountCredit(email: string, amount: number): Promise<DiscountCredit> {
  const rows = await getSql()`
    INSERT INTO discount_credits (customer_email, amount)
    VALUES (${email}, ${amount})
    RETURNING *
  `;
  return rows[0] as DiscountCredit;
}

// O crédito de desconto disponível mais antigo de um cliente (ou null se
// não tiver nenhum) — é o que a tela de pagamento oferece pra usar.
export async function getAvailableDiscountCredit(email: string): Promise<DiscountCredit | null> {
  const rows = await getSql()`
    SELECT * FROM discount_credits
    WHERE lower(customer_email) = lower(${email}) AND status = 'available'
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return (rows[0] as DiscountCredit) ?? null;
}

export async function markDiscountCreditUsed(id: number, orderId: number): Promise<void> {
  await getSql()`
    UPDATE discount_credits SET status = 'used', used_order_id = ${orderId}, used_at = now() WHERE id = ${id}
  `;
}
