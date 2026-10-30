// Fim da promoção do botão de franquia (admin > "🔥 Franquia em destaque"):
// a data (AAAA-MM-DD) vale o dia inteiro, até 23:59:59 no horário de
// Brasília. Usado no servidor (lib/catalogData.ts, que esconde a promoção
// vencida) e na tela (FeaturedPromoButton.tsx, contagem regressiva).
export function promoEndTime(endsAt: string): number {
  return new Date(`${endsAt}T23:59:59-03:00`).getTime();
}
