'use client';

// Página "Testes" — a sala de jogos da loja. Cada jogo da lista (games.ts)
// vira um card grande; clicar abre o jogo por cima da página, igual
// acontece na página inicial. Os jogos em si só são baixados quando alguém
// clica em jogar.
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import SiteHeader from '../SiteHeader';
import FloatingWhatsApp from '../FloatingWhatsApp';
import type { Item } from '../CatalogClient';
import { getCurrentUser, getAvatarUrl, onAuthChange } from '@/lib/wishlist';
import { afterPageLoad } from '@/lib/afterPageLoad';
import { fallbackToOriginal, imageSrcSet } from '@/lib/imageVariants';
import { linkImage, type LinkId } from '../qual-link/links';
import { QUAL_LINK_LOGIN_FLAG } from '../qual-link/loginFlag';
import { eligibleItems, variedCovers } from '../quiz/covers';
import { TESTES, comingSoonSlots, type TesteGame, type TesteId } from './games';
import { diaEm, formatarContador, msAteProximoDia } from '@/lib/jogos/dia';
import { resultadoDoDia, sequenciaGeralHoje } from '@/lib/jogos/progresso';
import { OC_FONTES } from './ocarina-hero/fontes';

const NIVEIS_SILHUETA = ['facil', 'medio', 'dificil', 'insano'];
import './testes.css';

const QualLinkQuiz = dynamic(() => import('../qual-link/QualLinkQuiz'), { ssr: false });
const GameQuizModal = dynamic(() => import('../quiz/GameQuizModal'), { ssr: false });

const ZELDA_LINKS: LinkId[] = ['ww', 'totk', 'oot'];
const COVER_COUNT = 5;

export default function TestesClient({
  items,
  whatsappContactUrl,
  ocarinaPublicado
}: {
  items: Item[];
  whatsappContactUrl: string | null;
  // Zelda Tour aberto pro público (admin > Zelda Tour)
  ocarinaPublicado: boolean;
}) {
  const router = useRouter();
  const [playing, setPlaying] = useState<TesteId | null>(null);

  // Quem está logado: o "Qual Link é você?" guarda o card na conta, e o
  // botão "Minha conta" mostra a foto. O login em si fica no catálogo.
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let stopListening = () => {};
    const cancel = afterPageLoad(() => {
      getCurrentUser()
        .then(setUser)
        .catch(() => {});
      stopListening = onAuthChange(setUser);
    });
    return () => {
      cancel();
      stopListening();
    };
  }, []);

  // Capas do card "Qual será seu próximo jogo?": na primeira pintura vão as
  // primeiras do catálogo (servidor e navegador desenham igual); depois
  // troca por um sorteio variado.
  const firstCovers = useMemo(() => eligibleItems(items).slice(0, COVER_COUNT), [items]);
  const [covers, setCovers] = useState(firstCovers);
  useEffect(() => {
    setCovers(variedCovers(items, COVER_COUNT));
  }, [items]);

  // Desafios diários: sequência geral, o que já foi feito hoje e o contador.
  // Só no navegador (vem do que está salvo no aparelho).
  const [hoje, setHoje] = useState<{ seq: number; silhueta: number; ocarina: boolean; restante: number } | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = diaEm();
      setHoje({
        seq: sequenciaGeralHoje(d).atual,
        silhueta: NIVEIS_SILHUETA.filter((n) => resultadoDoDia('silhueta', n, d)).length,
        ocarina: Boolean(resultadoDoDia('ocarina', 'dia', d)),
        restante: msAteProximoDia()
      });
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);
  const statusDoCard = (id: TesteId): string | null => {
    if (!hoje) return null;
    if (id === 'silhueta') return hoje.silhueta === NIVEIS_SILHUETA.length ? '✓ Feito hoje' : hoje.silhueta ? `${hoje.silhueta}/4 hoje` : null;
    return null;
  };

  // Sem jogos no catálogo o sorteio não tem o que sortear: o card nem aparece.
  const games = TESTES.filter((g) => g.id !== 'proximo-jogo' || firstCovers.length > 0);
  const slots = comingSoonSlots(games.length);

  return (
    <>
      <header className="site-header-bar" style={{ viewTransitionName: 'site-header' }}>
        <div className="site-header-bar-inner">
          <SiteHeader
            whatsappContactUrl={whatsappContactUrl}
            activeCatalog="testes"
            accountLabel="Minha conta"
            accountHref="/?conta=1"
            accountAvatar={getAvatarUrl(user)}
          />
        </div>
      </header>

      <main className="page-content testes-page">
        <section className="testes-hero">
          <div className="testes-hero-glow" aria-hidden="true" />
          <p className="testes-hero-seal">
            <span className="testes-hero-dot" aria-hidden="true" />
            Sala de jogos · {games.filter((g) => g.id !== 'feed').length + (ocarinaPublicado ? 1 : 0)} disponíveis
          </p>
          <h1 className="testes-hero-title">
            Escolha um jogo
            <br />e <em>aperte start</em>
          </h1>
          <p className="testes-hero-sub">
            Quizzes e jogos interativos da XAN Switch. É de graça, leva poucos minutos e alguns ainda rendem prêmio.
          </p>
          <div className={`testes-hoje${hoje ? '' : ' is-carregando'}`} aria-live="polite">
            <span className={`testes-hoje-seq${hoje && hoje.seq > 0 ? ' is-acesa' : ''}`}>
              <span aria-hidden="true">🔥</span>
              <strong>{hoje?.seq ?? 0}</strong> {hoje?.seq === 1 ? 'dia seguido' : 'dias seguidos'}
            </span>
            <span className="testes-hoje-item">
              <span className={hoje && hoje.silhueta === NIVEIS_SILHUETA.length ? 'is-feito' : ''}>
                {hoje && hoje.silhueta === NIVEIS_SILHUETA.length ? '✓' : '○'}
              </span>{' '}
              Silhueta do Dia {hoje ? `${hoje.silhueta}/${NIVEIS_SILHUETA.length}` : ''}
            </span>
            {ocarinaPublicado && (
              <span className="testes-hoje-item">
                <span className={hoje?.ocarina ? 'is-feito' : ''}>{hoje?.ocarina ? '✓' : '○'}</span> Música do Dia
              </span>
            )}
            <span className="testes-hoje-item">
              Novos desafios em <strong>{hoje ? formatarContador(hoje.restante) : '--:--:--'}</strong>
            </span>
          </div>
        </section>

        <BannerZeldaTour disponivel={ocarinaPublicado} />

        <ul className="testes-grid">
          {games.map((game, i) => (
            <li key={game.id} style={{ '--i': i } as React.CSSProperties}>
              <TesteCard game={game} number={i + 1} covers={covers} status={statusDoCard(game.id)} onPlay={() => setPlaying(game.id)} />
            </li>
          ))}
          {Array.from({ length: slots }, (_, i) => (
            <li key={`soon-${i}`} className={i > 0 ? 'is-extra-soon' : undefined} style={{ '--i': games.length + i } as React.CSSProperties}>
              <div className="teste-soon">
                <span className="teste-soon-number" aria-hidden="true">
                  {String(games.length + i + 1).padStart(2, '0')}
                </span>
                <span className="teste-soon-mark" aria-hidden="true">
                  ?
                </span>
                <p className="teste-soon-title">Novo jogo em breve</p>
                <p className="teste-soon-sub">Tem novidade sendo preparada. Volte logo pra jogar.</p>
              </div>
            </li>
          ))}
        </ul>
      </main>

      {/* O que abre em cada jogo. Jogo novo: mais um bloco aqui. */}
      {playing === 'qual-link' && (
        <QualLinkQuiz
          user={user}
          resumePending={false}
          onClose={() => setPlaying(null)}
          onRequestLogin={() => {
            // O login mora no catálogo: vai pra lá com o popup de conta
            // aberto. A marca faz o catálogo reabrir o quiz já no resultado,
            // pra pessoa pegar o card (ver CatalogClient.tsx).
            try {
              sessionStorage.setItem(QUAL_LINK_LOGIN_FLAG, '1');
            } catch {
              // sem sessionStorage: só não reabre o quiz sozinho
            }
            router.push('/?conta=1');
          }}
        />
      )}
      {playing === 'proximo-jogo' && (
        <GameQuizModal
          items={items}
          onClose={() => setPlaying(null)}
          onOpenGame={(item) => router.push(`/jogo/${item.id}`)}
        />
      )}

      <FloatingWhatsApp baseUrl={whatsappContactUrl} modalOpen={playing !== null} />
    </>
  );
}

function TesteCard({
  game,
  number,
  covers,
  status,
  onPlay
}: {
  game: TesteGame;
  number: number;
  covers: Item[];
  status: string | null;
  onPlay: () => void;
}) {
  const conteudo = (
    <>
      <span className="teste-card-art" aria-hidden="true" data-loader-skip>
        <TesteArt id={game.id} covers={covers} />
        <span className="teste-card-number">{String(number).padStart(2, '0')}</span>
        {status ? (
          <span className="teste-card-new is-status">{status}</span>
        ) : (
          game.isNew && <span className="teste-card-new">Novo</span>
        )}
      </span>
      <span className="teste-card-body">
        <span className="teste-card-kind">
          <span>{game.kind}</span>
          {game.meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </span>
        <span className="teste-card-title">{game.title}</span>
        <span className="teste-card-desc">{game.description}</span>
        <span className="teste-card-foot">
          {game.reward && (
            <span className="teste-card-reward">
              <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden="true">
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
              </svg>
              {game.reward}
            </span>
          )}
          <span className="teste-card-cta">
            {game.cta}
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </span>
        </span>
      </span>
    </>
  );
  // Jogo com página própria: o card é um link.
  if (game.href) {
    return (
      <Link href={game.href} className={`teste-card theme-${game.theme}`} aria-label={`Jogar: ${game.title}`}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button type="button" className={`teste-card theme-${game.theme}`} onClick={onPlay} aria-label={`Jogar: ${game.title}`}>
      {conteudo}
    </button>
  );
}

// Banner do Zelda Tour: "Em breve" até o jogo ser publicado em /admin > Zelda
// Tour e, depois disso, "Disponível para jogar". A pista é a mesma do jogo,
// com notas descendo até os anéis.
const OC_UI = '/jogos/ocarina/ui/';
// pista (0–4), cor e atraso de cada nota que desce no banner
const NOTAS_BANNER: [number, string, number][] = [
  [0, '#38d96a', 0],
  [2, '#ff4d5e', 0.45],
  [4, '#3d8bff', 0.9],
  [1, '#ffd23e', 1.35],
  [3, '#b06bff', 1.8],
  [2, '#ff4d5e', 2.25]
];
// centro de cada pista (% da imagem), lá no fundo e na linha dos anéis
const PISTA_FUNDO = [38.9, 44.5, 50.1, 55.7, 61.3];
const PISTA_ACERTO = [19.2, 34.7, 50.1, 65.6, 81];

function BannerZeldaTour({ disponivel }: { disponivel: boolean }) {
  return (
    <section className={`oc-breve ${OC_FONTES}${disponivel ? ' is-disponivel' : ''}`} aria-label={`Zelda Tour: ${disponivel ? 'disponível para jogar' : 'em breve'}`}>
      <div className="oc-breve-texto">
        <p className="oc-breve-selo">
          <span aria-hidden="true" />
          {disponivel ? 'Disponível para jogar' : 'Em breve'}
        </p>
        <h2 className="oc-breve-titulo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${OC_UI}brasao.webp`} alt="" width={220} height={131} decoding="async" />
          <span className="oc-breve-nome">Zelda Tour</span>
          <span className="oc-beta">Beta</span>
        </h2>
        <p className="oc-breve-sub">
          O jogo de ritmo da XAN: as notas descem pela pista e você toca no tempo da música. Acerte as Triforces, encha a barra e
          ative o especial.
        </p>
        <ul className="oc-breve-info">
          <li>🎵 Músicas de Zelda</li>
          <li>🔺 Especial dourado</li>
          <li>📱 Celular e computador</li>
          <li>🎶 Novas músicas em breve</li>
        </ul>
        {disponivel && (
          <Link className="oc-breve-jogar" href="/games-interativos/zelda-tour">
            ▶ Jogar agora
          </Link>
        )}
      </div>
      <div className="oc-breve-pista" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${OC_UI}banner-pista.webp`} alt="" width={820} height={443} decoding="async" />
        {PISTA_ACERTO.map((x, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} className="oc-breve-anel" src={`${OC_UI}anel-vazio.webp`} alt="" style={{ left: `${x}%` }} decoding="async" />
        ))}
        {NOTAS_BANNER.map(([p, cor, d], i) => (
          <i
            key={i}
            className="oc-breve-nota"
            style={{ '--cor': cor, '--x0': `${PISTA_FUNDO[p]}%`, '--x1': `${PISTA_ACERTO[p]}%`, '--d': `${d}s` } as React.CSSProperties}
          />
        ))}
      </div>
    </section>
  );
}

// Arte do card do Silhueta do Dia: três silhuetas no palco claro.
const SILHUETAS_CARD = ['/jogos/silhueta/441c41a9ab53-s.webp', '/jogos/silhueta/3c24a0e802ad-s.webp', '/jogos/silhueta/445023d4f0f5-s.webp'];

// A arte de cada card. Jogo novo: mais um "if" aqui.
function TesteArt({ id, covers }: { id: TesteId; covers: Item[] }) {
  if (id === 'feed') {
    return (
      <span className="teste-art teste-art-feed">
        <span className="teste-art-post is-0">
          <b>⬛⬛🟩 3/5</b>
          <i>🔥 12</i>
        </span>
        <span className="teste-art-post is-1">
          <b>⭐⭐⭐⭐☆ 92%</b>
          <i>🔥 8</i>
        </span>
        <span className="teste-art-post is-2">
          <b>🟩 1/3</b>
          <i>🔥 21</i>
        </span>
      </span>
    );
  }
  if (id === 'silhueta') {
    return (
      <span className="teste-art teste-art-silhueta">
        <span className="teste-art-raios" />
        {SILHUETAS_CARD.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} className={`is-${i}`} src={src} alt="" loading="lazy" decoding="async" />
        ))}
        <span className="teste-art-interrogacao">?</span>
      </span>
    );
  }
  if (id === 'qual-link') {
    return (
      <span className="teste-art teste-art-zelda">
        <span className="teste-art-triforce" />
        {ZELDA_LINKS.map((link, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={link} className={`is-${i}`} src={linkImage(link)} alt="" loading="lazy" decoding="async" />
        ))}
      </span>
    );
  }
  return (
    <span className="teste-art teste-art-arcade">
      <span className="teste-art-ring" />
      <span className="teste-art-fan">
        {covers.map((it, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${it.id}-${i}`}
            style={{ '--n': i - (covers.length - 1) / 2 } as React.CSSProperties}
            src={it.imageUrl!}
            srcSet={imageSrcSet(it.imageUrl!)}
            sizes="130px"
            onError={fallbackToOriginal}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ))}
      </span>
    </span>
  );
}
