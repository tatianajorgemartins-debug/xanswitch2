'use client';

// Aba "Jogos interativos" do admin: quem jogou os jogos da página Testes
// (Silhueta do Dia, Zelda Tour, Qual Link, Próximo jogo), com o resultado
// de cada partida, e a moderação do feed de resultados (/testes/feed).
// Dados de lib/jogosDb.ts; tabelas de db/migration-jogos-interativos.sql.
import { useMemo, useState, useTransition } from 'react';
import { deleteGamePostAction, setGamePostHiddenAction } from './jogosInterativosActions';

export type JogadaAdmin = {
  id: number;
  game: string;
  mode: string;
  dailyDay: string | null;
  won: boolean | null;
  score: number | null;
  summary: string;
  email: string | null;
  visitor: string;
  createdAt: string;
};
export type StatsJogoAdmin = { game: string; today: number; week: number; total: number; players7d: number };
export type PostAdmin = {
  id: number;
  game: string;
  title: string;
  resultText: string;
  comment: string;
  authorName: string;
  email: string;
  likes: number;
  hidden: boolean;
  createdAt: string;
};
export type JogosInterativosData = { plays: JogadaAdmin[]; stats: StatsJogoAdmin[]; posts: PostAdmin[] };

export const NOMES_JOGOS: Record<string, string> = {
  silhueta: '👤 Silhueta do Dia',
  ocarina: '🎵 Zelda Tour',
  'qual-link': '🗡️ Qual Link é você?',
  'proximo-jogo': '🎲 Próximo jogo'
};

const NOMES_MODO: Record<string, string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
  insano: 'Insano',
  dia: 'Música do Dia',
  livre: 'Modo livre',
  quiz: 'Quiz'
};
const nomeModo = (m: string) => (m.startsWith('treino-') ? `Treino · ${NOMES_MODO[m.slice(7)] ?? m.slice(7)}` : (NOMES_MODO[m] ?? m));

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function JogosInterativosPanel({ data }: { data: JogosInterativosData | null }) {
  const [aba, setAba] = useState<'jogadas' | 'feed'>('jogadas');
  if (!data) {
    return (
      <div className="adm-card">
        <h3>Falta criar as tabelas</h3>
        <p className="adm-help">
          Rode o arquivo <code>db/migration-jogos-interativos.sql</code> uma vez no editor SQL do Neon. Depois disso as
          partidas começam a aparecer aqui e o feed de resultados passa a funcionar.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="adm-chips" role="tablist">
        <button type="button" className={`adm-chip${aba === 'jogadas' ? ' is-on' : ''}`} onClick={() => setAba('jogadas')}>
          🕹️ Partidas ({data.plays.length}
          {data.plays.length >= 600 ? '+' : ''})
        </button>
        <button type="button" className={`adm-chip${aba === 'feed' ? ' is-on' : ''}`} onClick={() => setAba('feed')}>
          📣 Feed de resultados ({data.posts.length})
        </button>
      </div>
      {aba === 'jogadas' ? <Jogadas data={data} /> : <Feed posts={data.posts} />}
    </>
  );
}

function Jogadas({ data }: { data: JogosInterativosData }) {
  const [jogo, setJogo] = useState('');
  const [busca, setBusca] = useState('');
  const [soLogados, setSoLogados] = useState(false);
  const [semTreino, setSemTreino] = useState(true);
  const [limite, setLimite] = useState(100);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data.plays.filter(
      (p) =>
        (!jogo || p.game === jogo) &&
        (!soLogados || p.email) &&
        (!semTreino || !p.mode.startsWith('treino-')) &&
        (!q || `${p.email ?? ''} ${p.visitor} ${p.summary}`.toLowerCase().includes(q))
    );
  }, [data.plays, jogo, busca, soLogados, semTreino]);

  const totalHoje = data.stats.reduce((s, x) => s + x.today, 0);
  const totalSemana = data.stats.reduce((s, x) => s + x.week, 0);
  const jogadoresSemana = data.stats.reduce((s, x) => s + x.players7d, 0);
  const total = data.stats.reduce((s, x) => s + x.total, 0);

  return (
    <>
      <div className="adm-stats">
        <div className="adm-stat">
          <span>Partidas hoje</span>
          <strong>{totalHoje}</strong>
        </div>
        <div className="adm-stat">
          <span>Últimos 7 dias</span>
          <strong>{totalSemana}</strong>
        </div>
        <div className="adm-stat">
          <span>Jogadores (7 dias)</span>
          <strong>{jogadoresSemana}</strong>
          <small>somando os jogos</small>
        </div>
        <div className="adm-stat">
          <span>Partidas no total</span>
          <strong>{total}</strong>
        </div>
      </div>

      {data.stats.length > 0 && (
        <div className="adm-card">
          <h3>Por jogo</h3>
          <table className="adm-jogos-tabela">
            <thead>
              <tr>
                <th>Jogo</th>
                <th>Hoje</th>
                <th>7 dias</th>
                <th>Jogadores (7 dias)</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((s) => (
                <tr key={s.game}>
                  <td>{NOMES_JOGOS[s.game] ?? s.game}</td>
                  <td>{s.today}</td>
                  <td>{s.week}</td>
                  <td>{s.players7d}</td>
                  <td>{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="adm-filters adm-jogos-filtros">
        <label>
          Jogo
          <select value={jogo} onChange={(e) => setJogo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(NOMES_JOGOS).map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-jogos-busca">
          Buscar (e-mail, visitante, resultado)
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex: maria@ ou Donkey Kong" />
        </label>
        <label className="adm-check">
          <input type="checkbox" checked={soLogados} onChange={(e) => setSoLogados(e.target.checked)} /> Só quem tem conta
        </label>
        <label className="adm-check">
          <input type="checkbox" checked={semTreino} onChange={(e) => setSemTreino(e.target.checked)} /> Esconder treinos
        </label>
      </div>

      {filtradas.length === 0 ? (
        <p className="adm-empty">Nenhuma partida registrada{jogo || busca ? ' com esse filtro' : ' ainda'}.</p>
      ) : (
        <div className="adm-card adm-jogos-lista">
          <table className="adm-jogos-tabela">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Jogo</th>
                <th>Modo</th>
                <th>Resultado</th>
                <th>Jogador</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0, limite).map((p) => (
                <tr key={p.id}>
                  <td className="adm-muted">{quando(p.createdAt)}</td>
                  <td>{NOMES_JOGOS[p.game] ?? p.game}</td>
                  <td>
                    {nomeModo(p.mode)}
                    {p.dailyDay && <small className="adm-muted"> · dia {p.dailyDay.split('-').reverse().slice(0, 2).join('/')}</small>}
                  </td>
                  <td>
                    {p.won === true ? '✅ ' : p.won === false ? '❌ ' : ''}
                    {p.summary}
                  </td>
                  <td>{p.email ?? <span className="adm-muted">Visitante {p.visitor.slice(0, 6)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length > limite && (
            <button type="button" className="btn ghost" onClick={() => setLimite((l) => l + 200)}>
              Mostrar mais ({filtradas.length - limite} restantes)
            </button>
          )}
        </div>
      )}
      <p className="adm-help">
        Mostra as últimas 600 partidas. &quot;Visitante&quot; é quem jogou sem entrar na conta (cada aparelho tem um código
        próprio).
      </p>
    </>
  );
}

function Feed({ posts: iniciais }: { posts: PostAdmin[] }) {
  const [posts, setPosts] = useState(iniciais);
  const [pendente, startTransition] = useTransition();

  function alternar(p: PostAdmin) {
    startTransition(async () => {
      const r = await setGamePostHiddenAction(p.id, !p.hidden);
      if (r.ok) setPosts((l) => l.map((x) => (x.id === p.id ? { ...x, hidden: !p.hidden } : x)));
    });
  }
  function apagar(p: PostAdmin) {
    if (!window.confirm(`Apagar de vez o post de ${p.authorName}?`)) return;
    startTransition(async () => {
      const r = await deleteGamePostAction(p.id);
      if (r.ok) setPosts((l) => l.filter((x) => x.id !== p.id));
    });
  }

  if (!posts.length) return <p className="adm-empty">Ninguém publicou no feed ainda.</p>;
  return (
    <>
      <p className="adm-help">
        O que os clientes publicaram em <a href="/testes/feed" target="_blank" rel="noreferrer">/testes/feed</a>.
        <strong> Esconder</strong> tira do feed sem apagar; <strong>Apagar</strong> remove de vez.
      </p>
      <div className="adm-jogos-posts">
        {posts.map((p) => (
          <article key={p.id} className={`adm-card adm-jogos-post${p.hidden ? ' is-escondido' : ''}`}>
            <header>
              <strong>{p.authorName}</strong> <span className="adm-muted">· {p.email} · {quando(p.createdAt)}</span>
              {p.hidden && <span className="adm-badge">Escondido</span>}
            </header>
            <p className="adm-jogos-post-titulo">
              {NOMES_JOGOS[p.game] ?? p.game} — {p.title}
            </p>
            <pre>{p.resultText}</pre>
            {p.comment && <p>“{p.comment}”</p>}
            <footer>
              <span className="adm-muted">🔥 {p.likes}</span>
              <button type="button" className="btn ghost" disabled={pendente} onClick={() => alternar(p)}>
                {p.hidden ? 'Mostrar de novo' : 'Esconder'}
              </button>
              <button type="button" className="btn ghost adm-danger" disabled={pendente} onClick={() => apagar(p)}>
                Apagar
              </button>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
