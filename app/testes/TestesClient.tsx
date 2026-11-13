'use client';

// Página "Testes" — a sala de jogos da loja. Cada jogo da lista (games.ts)
// vira um card grande; clicar abre o jogo por cima da página, igual
// acontece na página inicial. Os jogos em si só são baixados quando alguém
// clica em jogar.
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
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
import './testes.css';

const QualLinkQuiz = dynamic(() => import('../qual-link/QualLinkQuiz'), { ssr: false });
const GameQuizModal = dynamic(() => import('../quiz/GameQuizModal'), { ssr: false });

const ZELDA_LINKS: LinkId[] = ['ww', 'botw', 'oot'];
const COVER_COUNT = 5;

export default function TestesClient({
  items,
  whatsappContactUrl
}: {
  items: Item[];
  whatsappContactUrl: string | null;
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
            Sala de jogos · {games.length} {games.length === 1 ? 'disponível' : 'disponíveis'}
          </p>
          <h1 className="testes-hero-title">
            Escolha um jogo
            <br />e <em>aperte start</em>
          </h1>
          <p className="testes-hero-sub">
            Testes e jogos interativos da XAN Switch. É de graça, leva poucos minutos e alguns ainda rendem prêmio.
          </p>
        </section>

        <ul className="testes-grid">
          {games.map((game, i) => (
            <li key={game.id} style={{ '--i': i } as React.CSSProperties}>
              <TesteCard game={game} number={i + 1} covers={covers} onPlay={() => setPlaying(game.id)} />
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
  onPlay
}: {
  game: TesteGame;
  number: number;
  covers: Item[];
  onPlay: () => void;
}) {
  return (
    <button type="button" className={`teste-card theme-${game.theme}`} onClick={onPlay} aria-label={`Jogar: ${game.title}`}>
      <span className="teste-card-art" aria-hidden="true" data-loader-skip>
        <TesteArt id={game.id} covers={covers} />
        <span className="teste-card-number">{String(number).padStart(2, '0')}</span>
        {game.isNew && <span className="teste-card-new">Novo</span>}
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
    </button>
  );
}

// A arte de cada card. Jogo novo: mais um "if" aqui.
function TesteArt({ id, covers }: { id: TesteId; covers: Item[] }) {
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
