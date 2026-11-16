// Banner promocional: uma imagem sua (ex: arte da Black Friday) que entra
// no lugar dos banners de "Destaque da semana" na página inicial, entre as
// datas que você escolher — independentes das datas das promoções.
// Configurado em /admin > 🏷️ Promoções (PromoBannerPanel.tsx); guardado em
// site_settings (chave PROMO_BANNER_KEY) como um JSON só, então não precisa
// rodar nada no banco. Mostrado por app/PromoSection.tsx.
//
// Este arquivo não acessa o banco: é usado também no navegador (admin).
import { eventStatus, type EventStatus } from './promoEvents';

export const PROMO_BANNER_KEY = 'promo_banner';

// O que acontece quando o cliente clica no banner:
//   'event' = mostra só os jogos marcados numa promoção (eventId);
//   'sale'  = mostra todos os jogos que estão em promoção agora;
//   'none'  = nada, é só a imagem.
export type PromoBannerAction = 'event' | 'sale' | 'none';

export type PromoBannerSetting = {
  imageUrl: string;
  // Arte própria pro celular (opcional) — lá o espaço é mais "quadrado".
  mobileImageUrl: string | null;
  // Descrição da imagem (pra leitores de tela e pro Google).
  alt: string;
  action: PromoBannerAction;
  // Promoção cujos jogos o clique mostra (só com action 'event').
  eventId: number | null;
  startsAt: string; // ISO
  endsAt: string | null;
  enabled: boolean;
};

// O que o catálogo recebe quando o banner está valendo. eventGames vem
// preenchido pelo servidor (lib/catalogData.ts) quando o clique mostra os
// jogos de uma promoção — inclusive antes de ela começar, já que o banner
// pode entrar uns dias antes como aviso.
export type ActivePromoBanner = Pick<PromoBannerSetting, 'imageUrl' | 'mobileImageUrl' | 'alt' | 'action'> & {
  eventGames: { label: string; ids: number[] } | null;
};

export function parsePromoBanner(raw: string | null): PromoBannerSetting | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PromoBannerSetting>;
    if (!v || typeof v.imageUrl !== 'string' || !v.imageUrl || typeof v.startsAt !== 'string') return null;
    const eventId = typeof v.eventId === 'number' && Number.isInteger(v.eventId) ? v.eventId : null;
    const action: PromoBannerAction =
      v.action === 'none' ? 'none' : v.action === 'event' && eventId !== null ? 'event' : 'sale';
    return {
      imageUrl: v.imageUrl,
      mobileImageUrl: typeof v.mobileImageUrl === 'string' && v.mobileImageUrl ? v.mobileImageUrl : null,
      alt: typeof v.alt === 'string' ? v.alt : '',
      action,
      eventId: action === 'event' ? eventId : null,
      startsAt: v.startsAt,
      endsAt: typeof v.endsAt === 'string' && v.endsAt ? v.endsAt : null,
      enabled: v.enabled !== false
    };
  } catch {
    return null;
  }
}

export function promoBannerStatus(b: PromoBannerSetting, now: number = Date.now()): EventStatus {
  return eventStatus({ enabled: b.enabled, starts_at: new Date(b.startsAt), ends_at: b.endsAt ? new Date(b.endsAt) : null }, now);
}

// O banner salvo, só se estiver dentro do período e ativado.
export function runningPromoBanner(raw: string | null): PromoBannerSetting | null {
  const b = parsePromoBanner(raw);
  return b && promoBannerStatus(b) === 'ativo' ? b : null;
}
