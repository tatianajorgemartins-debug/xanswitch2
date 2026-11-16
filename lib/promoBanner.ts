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

// O que acontece quando o cliente clica no banner.
export type PromoBannerAction = 'sale' | 'none';

export type PromoBannerSetting = {
  imageUrl: string;
  // Arte própria pro celular (opcional) — lá o espaço é mais "quadrado".
  mobileImageUrl: string | null;
  // Descrição da imagem (pra leitores de tela e pro Google).
  alt: string;
  action: PromoBannerAction;
  startsAt: string; // ISO
  endsAt: string | null;
  enabled: boolean;
};

// O que o catálogo recebe quando o banner está valendo.
export type ActivePromoBanner = Pick<PromoBannerSetting, 'imageUrl' | 'mobileImageUrl' | 'alt' | 'action'>;

export function parsePromoBanner(raw: string | null): PromoBannerSetting | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PromoBannerSetting>;
    if (!v || typeof v.imageUrl !== 'string' || !v.imageUrl || typeof v.startsAt !== 'string') return null;
    return {
      imageUrl: v.imageUrl,
      mobileImageUrl: typeof v.mobileImageUrl === 'string' && v.mobileImageUrl ? v.mobileImageUrl : null,
      alt: typeof v.alt === 'string' ? v.alt : '',
      action: v.action === 'none' ? 'none' : 'sale',
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

export function activePromoBanner(raw: string | null): ActivePromoBanner | null {
  const b = parsePromoBanner(raw);
  if (!b || promoBannerStatus(b) !== 'ativo') return null;
  return { imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl, alt: b.alt, action: b.action };
}
