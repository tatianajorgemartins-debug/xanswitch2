// Eventos de promoção (Black Friday e afins): um desconto igual pra vários
// jogos de uma vez, com etiqueta própria, a partir de uma data/hora.
// Criados em /admin > 🏷️ Promoções (PromoEventsPanel.tsx); aplicados aos
// jogos em lib/db.ts (attachPromoEvents) e no preço em lib/gamePrice.ts —
// o mesmo lugar que o catálogo e a cobrança do Mercado Pago usam, então o
// desconto vale igual em todo o site.
//
// Este arquivo não acessa o banco: é usado também no navegador (admin).

export type DiscountType = 'fixed' | 'percent';

export type PromoEventRow = {
  id: number;
  name: string;
  tag_text: string;
  tag_color: string;
  discount_type: DiscountType;
  discount_value: string; // numeric vem como string
  starts_at: Date;
  ends_at: Date | null;
  enabled: boolean;
  created_at: Date;
  game_ids: number[];
};

// O que fica pendurado em cada jogo enquanto o evento está valendo.
export type GamePromoEvent = {
  id: number;
  tagText: string;
  tagColor: string;
  price: number;
};

// Menor preço que um evento deixa um jogo custar.
const MIN_PRICE = 1;

// Preço do jogo com o desconto do evento. Devolve o próprio preço quando o
// desconto não muda nada.
export function priceWithEvent(base: number, type: DiscountType, value: number): number {
  if (!(value > 0)) return base;
  const raw = type === 'percent' ? base * (1 - Math.min(value, 95) / 100) : base - value;
  const rounded = Math.round(Math.max(MIN_PRICE, raw) * 100) / 100;
  return rounded < base ? rounded : base;
}

export type EventStatus = 'agendado' | 'ativo' | 'encerrado' | 'pausado';

export function eventStatus(
  e: Pick<PromoEventRow, 'enabled' | 'starts_at' | 'ends_at'>,
  now: number = Date.now()
): EventStatus {
  if (!e.enabled) return 'pausado';
  if (new Date(e.starts_at).getTime() > now) return 'agendado';
  if (e.ends_at && new Date(e.ends_at).getTime() <= now) return 'encerrado';
  return 'ativo';
}

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  agendado: '🕒 Agendado',
  ativo: '🟢 Valendo agora',
  encerrado: '⚪ Encerrado',
  pausado: '⏸ Pausado'
};
