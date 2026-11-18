'use client';

// Feed dos jogadores (/games-interativos/feed): publicar o próprio resultado e ver,
// curtir (🔥) os dos outros. Publicar e curtir exigem conta; ver, não.
// Os resultados publicáveis ficam guardados no aparelho quando a pessoa
// termina um jogo (lib/jogos/registro.ts). ?publicar=<id> já abre com um
// resultado escolhido.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { getAccessToken, getCurrentUser, getInstagramHandle, onAuthChange } from '@/lib/wishlist';
import { lerPublicaveis, marcarPublicado, type Publicavel } from '@/lib/jogos/registro';
import { diaEm } from '@/lib/jogos/dia';
import { resultadoDoDia } from '@/lib/jogos/progresso';
import { apagarMeuPostAction, curtirAction, listarFeedAction, publicarResultadoAction, type PostFeed } from '../jogosActions';
import './feed.css';

const TODOS_JOGOS: { id: string; nome: string; icone: string; href: string }[] = [
  { id: 'silhueta', nome: 'Silhueta do Dia', icone: '👤', href: '/games-interativos/silhueta' },
  { id: 'ocarina', nome: 'Zelda Tour', icone: '🎵', href: '/games-interativos/zelda-tour' },
  { id: 'qual-link', nome: 'Qual Link é você?', icone: '🗡️', href: '/games-interativos' },
  { id: 'proximo-jogo', nome: 'Próximo jogo', icone: '🎲', href: '/games-interativos' }
];
const jogoInfo = (id: string) => TODOS_JOGOS.find((j) => j.id === id) ?? { id, nome: id, icone: '🎮', href: '/games-interativos' };

function tempoAtras(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 7) return d === 1 ? 'ontem' : `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
}

export default function FeedClient({ ocarinaPublicado }: { ocarinaPublicado: boolean }) {
  // Zelda Tour fora do ar (admin): fica fora dos filtros e atalhos.
  const JOGOS = TODOS_JOGOS.filter((j) => j.id !== 'ocarina' || ocarinaPublicado);
  const [user, setUser] = useState<User | null>(null);
  const [userPronto, setUserPronto] = useState(false);
  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {})
      .finally(() => setUserPronto(true));
    return onAuthChange(setUser);
  }, []);

  const [filtro, setFiltro] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostFeed[] | null>(null);
  const [curtidos, setCurtidos] = useState<Set<number>>(new Set());
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async (antesDe: number | null, jogo: string | null) => {
    setCarregando(true);
    const token = await getAccessToken().catch(() => null);
    const r = await listarFeedAction(token, antesDe, jogo).catch(() => ({ ok: false as const, erro: 'O feed não carregou. Tente de novo.' }));
    setCarregando(false);
    if (!r.ok) {
      setErro(r.erro);
      if (antesDe === null) setPosts([]);
      return;
    }
    setErro(null);
    setPosts((antes) => (antesDe === null ? r.posts : [...(antes ?? []), ...r.posts]));
    setCurtidos((antes) => new Set([...(antesDe === null ? [] : antes), ...r.curtidos]));
    setTemMais(r.temMais);
  }, []);

  // Recarrega ao trocar o filtro e quando o login muda (curtidas).
  useEffect(() => {
    if (userPronto) carregar(null, filtro);
  }, [filtro, user?.id, userPronto, carregar]);

  async function curtir(p: PostFeed) {
    if (!user) {
      window.location.href = '/?conta=1';
      return;
    }
    // Muda na hora e confirma com o servidor.
    const ja = curtidos.has(p.id);
    setCurtidos((s) => {
      const n = new Set(s);
      if (ja) n.delete(p.id);
      else n.add(p.id);
      return n;
    });
    setPosts((l) => l?.map((x) => (x.id === p.id ? { ...x, curtidas: x.curtidas + (ja ? -1 : 1) } : x)) ?? l);
    const token = await getAccessToken().catch(() => null);
    const r = await curtirAction(token, p.id).catch(() => ({ ok: false as const }));
    if (r.ok) {
      setCurtidos((s) => {
        const n = new Set(s);
        if (r.curtido) n.add(p.id);
        else n.delete(p.id);
        return n;
      });
      setPosts((l) => l?.map((x) => (x.id === p.id ? { ...x, curtidas: r.curtidas } : x)) ?? l);
    }
  }

  async function apagar(p: PostFeed) {
    if (!window.confirm('Apagar seu post do feed?')) return;
    const token = await getAccessToken().catch(() => null);
    const r = await apagarMeuPostAction(token, p.id).catch(() => ({ ok: false }));
    if (r.ok) setPosts((l) => l?.filter((x) => x.id !== p.id) ?? l);
  }

  return (
    <main className="page-content feed-page">
      <div className="feed-topo">
        <Link href="/games-interativos" className="feed-voltar">
          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Jogos
        </Link>
      </div>
      <header className="feed-cabeca">
        <p className="feed-kicker">Comunidade XAN</p>
        <h1 className="feed-titulo">
          Feed dos <em>jogadores</em>
        </h1>
        <p className="feed-sub">Publique seu resultado, veja quem mandou bem hoje e solte um 🔥 nos melhores.</p>
      </header>

      <Publicar
        jogos={JOGOS}
        user={user}
        userPronto={userPronto}
        onPublicado={(p) => {
          setPosts((l) => [p, ...(l ?? [])]);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <div className="feed-filtros" role="group" aria-label="Filtrar por jogo">
        <button type="button" className={filtro === null ? 'is-on' : ''} onClick={() => setFiltro(null)}>
          Todos
        </button>
        {JOGOS.map((j) => (
          <button key={j.id} type="button" className={filtro === j.id ? 'is-on' : ''} onClick={() => setFiltro(j.id)}>
            <span aria-hidden="true">{j.icone}</span> {j.nome}
          </button>
        ))}
      </div>

      {erro && (
        <p className="feed-erro" role="alert">
          {erro}
        </p>
      )}

      {posts === null ? (
        <div className="feed-lista" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="feed-post is-esqueleto" />
          ))}
        </div>
      ) : posts.length === 0 && !erro ? (
        <div className="feed-vazio">
          <p className="feed-vazio-icone" aria-hidden="true">
            📣
          </p>
          <p>
            <strong>Ninguém publicou {filtro ? `em ${jogoInfo(filtro).nome} ` : ''}ainda.</strong>
          </p>
          <p>Jogue um desafio e seja o primeiro a aparecer aqui!</p>
        </div>
      ) : (
        <ol className="feed-lista">
          {posts.map((p, i) => (
            <li key={p.id} style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
              <Post post={p} curtido={curtidos.has(p.id)} onCurtir={() => curtir(p)} onApagar={() => apagar(p)} />
            </li>
          ))}
        </ol>
      )}
      {temMais && posts && (
        <button type="button" className="feed-mais" disabled={carregando} onClick={() => carregar(posts[posts.length - 1]?.id ?? null, filtro)}>
          {carregando ? 'Carregando…' : 'Ver mais'}
        </button>
      )}
    </main>
  );
}

function Avatar({ nome, foto }: { nome: string; foto: string | null }) {
  const [falhou, setFalhou] = useState(false);
  if (foto && !falhou) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="feed-avatar" src={foto} alt="" referrerPolicy="no-referrer" onError={() => setFalhou(true)} />;
  }
  return (
    <span className="feed-avatar is-letra" aria-hidden="true">
      {nome.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function Post({ post, curtido, onCurtir, onApagar }: { post: PostFeed; curtido: boolean; onCurtir: () => void; onApagar: () => void }) {
  const jogo = jogoInfo(post.jogo);
  return (
    <article className={`feed-post jogo-${post.jogo}`}>
      <header className="feed-post-topo">
        <Avatar nome={post.autor} foto={post.foto} />
        <div className="feed-post-quem">
          <strong>{post.autor}</strong>
          <span>
            {tempoAtras(post.criadoEm)} · <Link href={jogo.href}>{jogo.icone} {jogo.nome}</Link>
          </span>
        </div>
        {post.meu && (
          <button type="button" className="feed-post-apagar" onClick={onApagar} aria-label="Apagar meu post">
            ✕
          </button>
        )}
      </header>
      <div className={`feed-placar${post.imagem ? ' tem-imagem' : ''}`}>
        {post.imagem && <ImagemDoPost post={post} />}
        <div>
          <p className="feed-placar-titulo">{post.titulo}</p>
          <p className="feed-placar-texto">{post.resultado}</p>
        </div>
      </div>
      {post.comentario && <p className="feed-comentario">{post.comentario}</p>}
      <footer className="feed-post-pe">
        <button type="button" className={`feed-curtir${curtido ? ' is-on' : ''}`} onClick={onCurtir} aria-pressed={curtido}>
          <span aria-hidden="true">🔥</span> {post.curtidas > 0 ? post.curtidas : ''}
          <span className="feed-sr">{curtido ? 'Tirar curtida' : 'Curtir'}</span>
        </button>
        <Link className="feed-jogar" href={jogo.href}>
          Jogar também →
        </Link>
      </footer>
    </article>
  );
}

// Imagem do jogo no post. Silhueta do Dia: o personagem só aparece colorido
// pra quem já jogou aquele nível naquele dia (ou depois que o dia passou) —
// pros outros, fica a silhueta, pra não estragar o desafio.
function ImagemDoPost({ post }: { post: PostFeed }) {
  const img = post.imagem;
  if (!img) return null;
  if (img.tipo === 'foto') {
    return (
      <span className={`feed-img is-${img.formato}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt={img.alt} loading="lazy" decoding="async" />
      </span>
    );
  }
  const revelar = post.meu || img.dia < diaEm() || Boolean(resultadoDoDia('silhueta', img.nivel, img.dia));
  return (
    <span className="feed-img is-silhueta" title={revelar ? img.nome : 'Jogue o desafio pra ver quem é'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={revelar ? img.cor : img.silhueta} alt={revelar ? img.nome : 'Personagem misterioso'} loading="lazy" decoding="async" />
      {!revelar && <span className="feed-img-selo">?</span>}
    </span>
  );
}

// ---------- Publicar ----------

function Publicar({
  jogos,
  user,
  userPronto,
  onPublicado
}: {
  jogos: typeof TODOS_JOGOS;
  user: User | null;
  userPronto: boolean;
  onPublicado: (p: PostFeed) => void;
}) {
  const [lista, setLista] = useState<Publicavel[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    const l = lerPublicaveis();
    setLista(l);
    const pedido = new URLSearchParams(window.location.search).get('publicar');
    const alvo = l.find((x) => x.id === pedido && !x.publicado) ?? l.find((x) => !x.publicado);
    setEscolhido(alvo?.id ?? null);
  }, []);

  // Nome sugerido: o @ do Instagram da conta, ou o nome da conta Google.
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const nomeConta = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '';
    setNome((n) => n || nomeConta.split(' ')[0] || '');
    getInstagramHandle()
      .then((ig) => ig && setNome((n) => (!n || n === nomeConta.split(' ')[0] ? `@${ig.replace(/^@/, '')}` : n)))
      .catch(() => {});
  }, [user]);

  const naoPublicados = useMemo(() => lista.filter((x) => !x.publicado), [lista]);
  const atual = naoPublicados.find((x) => x.id === escolhido) ?? null;

  async function publicar() {
    if (!atual) return;
    setEnviando(true);
    setMsg(null);
    const token = await getAccessToken().catch(() => null);
    const r = await publicarResultadoAction(token, {
      jogo: atual.jogo,
      modo: atual.modo,
      titulo: atual.titulo,
      resultado: atual.resultado,
      comentario,
      nome
    }).catch(() => ({ ok: false as const, erro: 'A conexão falhou. Tente de novo.' }));
    setEnviando(false);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.erro });
      return;
    }
    marcarPublicado(atual.id);
    const nova = lerPublicaveis();
    setLista(nova);
    setEscolhido(nova.find((x) => !x.publicado)?.id ?? null);
    setComentario('');
    setMsg({ tipo: 'ok', texto: 'Publicado! Seu resultado já está no feed.' });
    onPublicado(r.post);
  }

  return (
    <section className="feed-publicar" aria-label="Publicar meu resultado">
      <h2>Publicar meu resultado</h2>
      {!userPronto ? null : !user ? (
        <div className="feed-publicar-login">
          <p>Entre na sua conta pra publicar seus resultados e curtir os da galera.</p>
          <Link className="feed-botao is-principal" href="/?conta=1">
            Entrar na conta
          </Link>
        </div>
      ) : naoPublicados.length === 0 ? (
        <div className="feed-publicar-vazio">
          <p>
            {lista.length ? 'Você já publicou todos os seus resultados. ' : ''}Termine um jogo e o resultado aparece aqui pra publicar.
          </p>
          <div className="feed-publicar-jogos">
            {jogos.slice(0, 2).map((j) => (
              <Link key={j.id} className="feed-botao" href={j.href}>
                {j.icone} {j.nome}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="feed-escolher" role="radiogroup" aria-label="Qual resultado">
            {naoPublicados.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === escolhido}
                className={p.id === escolhido ? 'is-on' : ''}
                onClick={() => setEscolhido(p.id)}
              >
                <span aria-hidden="true">{jogoInfo(p.jogo).icone}</span> {p.titulo}
                <small>{tempoAtras(p.criadoEm)}</small>
              </button>
            ))}
          </div>
          {atual && (
            <div className="feed-placar is-previa">
              <p className="feed-placar-titulo">{atual.titulo}</p>
              <p className="feed-placar-texto">{atual.resultado}</p>
            </div>
          )}
          <div className="feed-form">
            <label>
              Seu nome no feed
              <input value={nome} maxLength={30} onChange={(e) => setNome(e.target.value)} placeholder="ex: @seuinsta" />
            </label>
            <label>
              Comentário (opcional)
              <textarea
                value={comentario}
                maxLength={140}
                rows={2}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Ex: hoje foi difícil! 😅"
              />
              <small>{comentario.length}/140 · links não aparecem</small>
            </label>
          </div>
          <button type="button" className="feed-botao is-principal" disabled={enviando || !atual} onClick={publicar}>
            {enviando ? 'Publicando…' : '📣 Publicar no feed'}
          </button>
        </>
      )}
      {msg && (
        <p className={`feed-msg is-${msg.tipo}`} role="status">
          {msg.texto}
        </p>
      )}
    </section>
  );
}
