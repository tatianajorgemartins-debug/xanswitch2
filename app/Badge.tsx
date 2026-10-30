// Etiquetas dos cards e banners num visual só, com 3 variantes (+ o
// ranking dos mais desejados, numa cor só):
// - plataforma: "Switch 2" (vermelho Nintendo);
// - status: Pré-venda, Reserva, Expansão, Top… (mesma cor neutra);
// - oferta: "-X%" (amarelo de promoção).
// A etiqueta do admin (texto livre + cor) vira plataforma ou status pelo
// texto — a cor escolhida no admin não é mais usada nos cards, pra não ter
// 7 estilos diferentes disputando atenção.
import type { ReactNode } from 'react';
import { normalizeText } from '@/lib/search';

export type BadgeKind = 'platform' | 'status' | 'offer' | 'rank';

export function adminBadgeKind(text: string): 'platform' | 'status' {
  return normalizeText(text).includes('switch 2') ? 'platform' : 'status';
}

// Explicação curta ao passar o mouse (title) — "Pré-venda" e "Reserva"
// confundem quem chega pela primeira vez.
const BADGE_HINTS: Record<string, string> = {
  'pre venda': 'Pré-venda: o jogo ainda não foi lançado — você garante agora e recebe o código no lançamento.',
  reserva: 'Reserva: {{PREENCHER: diferença entre pré-venda e reserva}}',
  expansao: 'Expansão: conteúdo extra (DLC) — precisa ter o jogo base.'
};

export function badgeHint(text: string): string | undefined {
  return BADGE_HINTS[normalizeText(text)];
}

export default function Badge({
  kind,
  className,
  title,
  children
}: {
  kind: BadgeKind;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={`badge badge-${kind}${className ? ` ${className}` : ''}`} title={title}>
      {children}
    </span>
  );
}
