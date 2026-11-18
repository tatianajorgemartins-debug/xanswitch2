'use client';

// Aba "Zelda Tour" do admin: abre o jogo pro público, publica as músicas e
// lista as montadas por você (áudio + notas). Cada uma abre no editor
// (/admin/ocarina/[id]).
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { criarMusicaAction, publicarJogoAction, publicarMusicaAction } from './ocarina/actions';

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

export default function OcarinaAdminPanel({ musicas, jogoPublicado }: { musicas: MusicaAdmin[] | null; jogoPublicado: boolean }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O que está sendo publicado agora: 'jogo' ou o id da música.
  const [mudando, setMudando] = useState<'jogo' | number | null>(null);

  async function publicarJogo() {
    const texto = jogoPublicado
      ? 'Tirar o Zelda Tour do ar? Ele some do site e volta o banner "Em breve".'
      : 'Publicar o Zelda Tour? Ele fica aberto pra todo mundo na página Testes.';
    if (!window.confirm(texto)) return;
    setMudando('jogo');
    setErro(null);
    const r = await publicarJogoAction(!jogoPublicado).catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    if (r.ok) router.refresh();
    else setErro(r.erro);
    setMudando(null);
  }

  async function publicarMusica(m: MusicaAdmin) {
    setMudando(m.id);
    setErro(null);
    const r = await publicarMusicaAction(m.id, !m.publicada).catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    if (r.ok) router.refresh();
    else setErro(r.erro);
    setMudando(null);
  }

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
      <div className={`adm-card oc-adm-jogo${jogoPublicado ? ' is-no-ar' : ''}`}>
        <div>
          <h3>{jogoPublicado ? '🟢 O jogo está no ar' : '⚪ O jogo está fora do ar'}</h3>
          <p className="adm-help">
            {jogoPublicado
              ? 'Todo mundo pode jogar na página Testes, com as músicas publicadas abaixo.'
              : 'Só você vê as mudanças por aqui. No site aparece o banner "Em breve" até você publicar.'}
          </p>
        </div>
        <button type="button" className={`btn ${jogoPublicado ? 'ghost' : 'primary'}`} onClick={publicarJogo} disabled={mudando !== null}>
          {mudando === 'jogo' ? 'Salvando…' : jogoPublicado ? 'Tirar o jogo do ar' : 'Publicar o jogo'}
        </button>
      </div>
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
                  <td className="oc-adm-acoes">
                    <button
                      type="button"
                      className={`btn ${m.publicada ? 'ghost' : 'primary'}`}
                      onClick={() => publicarMusica(m)}
                      disabled={mudando !== null || (!m.publicada && (!m.temAudio || m.notas < 10))}
                      title={!m.publicada && (!m.temAudio || m.notas < 10) ? 'Precisa de áudio e de pelo menos 10 notas' : undefined}
                    >
                      {mudando === m.id ? 'Salvando…' : m.publicada ? 'Despublicar' : 'Publicar'}
                    </button>
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
        com a música e coloque as notas nas 5 cores. Marque as notas Triforce, use &quot;Testar no jogo&quot; e, quando estiver bom, publique a música aqui na lista.
      </p>
    </>
  );
}
