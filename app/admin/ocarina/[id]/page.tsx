import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { dificuldadesDaMusica, getAllOcarinaSongs, getOcarinaSong } from '@/lib/ocarinaDb';
import type { Dificuldade } from '@/app/games-interativos/ocarina-hero/ocarina';
import EditorMusica from './EditorMusica';
import '../../admin.css';
import '../editor.css';

// Editor de uma música do Zelda Tour (admin > Zelda Tour > Editar).
export const dynamic = 'force-dynamic';

export default async function EditarMusicaPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const m = await getOcarinaSong(id).catch(() => null);
  if (!m) notFound();
  const todas = await getAllOcarinaSongs().catch(() => []);
  const jogos = [...new Set(todas.map((s) => s.game).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const dificuldade = (['facil', 'medio', 'dificil', 'insano'].includes(m.difficulty) ? m.difficulty : 'medio') as Dificuldade;
  const { notas, liberadas } = dificuldadesDaMusica(m);
  return (
    <EditorMusica
      jogos={jogos}
      musica={{
        id: m.id,
        titulo: m.title,
        jogo: m.game,
        dificuldade,
        bpm: m.bpm,
        inicioBatida: m.beat_offset,
        audioUrl: m.audio_url,
        duracao: m.audio_duration,
        bytes: m.audio_bytes,
        charts: notas,
        liberadas: liberadas as Dificuldade[],
        publicada: m.published,
        ativaDesde: m.active_from,
        fimEm: m.end_at,
        fundo: m.background_url
      }}
    />
  );
}
