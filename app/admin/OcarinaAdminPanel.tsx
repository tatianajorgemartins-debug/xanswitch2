'use client';

// Aba "Ocarina Hero" do admin: as músicas montadas por você (áudio +
// notas). Cada uma abre no editor (/admin/ocarina/[id]).
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { criarMusicaAction } from './ocarina/actions';

export type MusicaAdmin = {
  id: number;
  titulo: string;
  jogo: string;
  dificuldade: string;
  notas: number;
  duracao: number | null;
  temAudio: boolean;
  publicada: boolean;
  atualizadaEm: string;
};

const DIF: Record<string, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', insano: 'Insano' };
const dur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '—');

export default function OcarinaAdminPanel({ musicas, jogoLigado }: { musicas: MusicaAdmin[] | null; jogoLigado: boolean }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setCriando(true);
    setErro(null);
    const r = await criarMusicaAction().catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    if (r.ok) router.push(`/admin/ocarina/${r.id}`);
    else {
      setErro(r.erro);
      setCriando(false);
    }
  }

  if (musicas === null) {
    return (
      <div className="adm-card">
        <h3>Falta criar a tabela das músicas</h3>
        <p className="adm-help">
          Rode o arquivo <code>db/migration-ocarina-musicas.sql</code> uma vez no editor SQL do Neon e atualize esta página.
        </p>
      </div>
    );
  }

  return (
    <>
      {!jogoLigado && (
        <p className="adm-help">
          ⚠️ O Ocarina Hero ainda está desligado no site — as músicas publicadas aparecem lá quando ele for ligado.
        </p>
      )}
      <div className="oc-adm-topo">
        <button type="button" className="btn primary" onClick={criar} disabled={criando}>
          {criando ? 'Criando…' : '＋ Nova música'}
        </button>
        {erro && <span className="adm-danger">{erro}</span>}
      </div>
      {musicas.length === 0 ? (
        <p className="adm-empty">Nenhuma música ainda. Clique em &quot;Nova música&quot;, envie o mp3 e posicione as notas.</p>
      ) : (
        <div className="adm-card oc-adm-lista">
          <table className="adm-jogos-tabela">
            <thead>
              <tr>
                <th>Música</th>
                <th>Jogo</th>
                <th>Dificuldade</th>
                <th>Duração</th>
                <th>Notas</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {musicas.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.titulo}</strong>
                  </td>
                  <td>{m.jogo || <span className="adm-muted">—</span>}</td>
                  <td>{DIF[m.dificuldade] ?? m.dificuldade}</td>
                  <td>{m.temAudio ? dur(m.duracao) : <span className="adm-muted">sem áudio</span>}</td>
                  <td>{m.notas}</td>
                  <td>{m.publicada ? '✅ Publicada' : <span className="adm-muted">Rascunho</span>}</td>
                  <td>
                    <Link className="btn ghost" href={`/admin/ocarina/${m.id}`}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="adm-help">
        Como fazer: crie a música, envie o mp3 (ele é compactado no seu navegador), acerte o BPM e o 1º tempo pra grade bater
        com a música e coloque as notas nas 5 cores. Use &quot;Testar no jogo&quot; e, quando estiver bom, &quot;Publicar no jogo&quot;.
      </p>
    </>
  );
}
