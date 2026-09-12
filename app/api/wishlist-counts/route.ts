import { NextResponse } from 'next/server';
import { getWishlistCounts } from '@/lib/supabaseAdmin';

// Sem isso, o número de favoritos de cada jogo só atualizava quando o cache
// da página inicial expirasse (até 1 hora) — essa rota é chamada direto do
// navegador (CatalogClient.tsx) toda vez que a página carrega e sempre que
// alguém favorita/desfavorita um jogo, pra manter a vitrine "Mais
// desejados" sempre em dia. force-dynamic garante que a própria rota nunca
// fique presa num cache antigo.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const counts = await getWishlistCounts();
    return NextResponse.json({ counts: Object.fromEntries(counts) });
  } catch {
    // Se o Supabase da lista de desejos não estiver configurado ainda, não
    // quebra a vitrine — ela só fica vazia até a migração ser rodada.
    return NextResponse.json({ counts: {} });
  }
}
