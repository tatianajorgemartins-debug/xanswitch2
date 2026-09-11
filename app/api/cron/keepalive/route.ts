import { NextResponse, type NextRequest } from 'next/server';
import { pingKeepAlive } from '@/lib/supabaseAdmin';

// Chamado uma vez por dia pela Vercel (veja "crons" em vercel.json). O
// único trabalho dele é registrar uma linha bem pequena no banco do
// Supabase, pra evitar que o projeto gratuito seja pausado por
// "inatividade" — o Supabase só considera consultas ao banco de dados
// dele como atividade, e este site usa o Supabase só pra guardar imagens
// (Storage), então sem esse ping o projeto correria risco de pausar
// mesmo com visitantes reais no site.
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Confere que quem está chamando é realmente a Vercel, e não qualquer
  // pessoa que descobriu essa URL — a Vercel manda esse cabeçalho
  // automaticamente quando CRON_SECRET está configurado no projeto.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    await pingKeepAlive();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha no keepalive.' },
      { status: 500 }
    );
  }
}
