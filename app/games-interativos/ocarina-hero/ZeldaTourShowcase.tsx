// Banner do Zelda Tour na página inicial (no lugar do antigo "Qual será seu
// próximo jogo?", abaixo do "Qual Link é você?"). É só a porta de entrada:
// leva pro jogo. Tudo animado em CSS (zelda-tour-showcase.css): o cenário
// da floresta andando devagar, vaga-lumes, e a pista do jogo com as notas
// descendo até os anéis e brilhando no acerto.
import Link from 'next/link';
import { cinzel } from '@/app/qual-link/fonts';
import './zelda-tour-showcase.css';

const UI = '/jogos/ocarina/ui/';
// pista (0–4), cor e atraso de cada nota que desce
const NOTAS: [number, string, number][] = [
  [0, '#38d96a', 0],
  [2, '#ff4d5e', 0.4],
  [4, '#3d8bff', 0.8],
  [1, '#ffd23e', 1.2],
  [3, '#b06bff', 1.6],
  [2, '#ff4d5e', 2.0]
];
// centro de cada pista (% da imagem da pista), lá no fundo e na linha dos anéis
const FUNDO = [38.9, 44.5, 50.1, 55.7, 61.3];
const ACERTO = [19.2, 34.7, 50.1, 65.6, 81];

export default function ZeldaTourShowcase({ aberto, variant = 'side' }: { aberto: boolean; variant?: 'side' | 'compact' }) {
  return (
    <Link
      href={aberto ? '/games-interativos/zelda-tour' : '/games-interativos'}
      className={`zt-showcase zt-showcase-${variant} ${cinzel.variable}`}
      aria-label={aberto ? 'Jogar o Zelda Tour, o jogo de ritmo da XAN Switch' : 'Zelda Tour: jogo de ritmo, em breve'}
    >
      <span className="zt-cenario" aria-hidden="true" />
      <span className="zt-luzes" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <i key={i} />
        ))}
      </span>

      <span className="zt-pista" aria-hidden="true" data-loader-skip>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="zt-pista-img" src={`${UI}banner-pista.webp`} alt="" width={820} height={443} loading="lazy" decoding="async" />
        {ACERTO.map((x, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} className="zt-anel" src={`${UI}anel-vazio.webp`} alt="" style={{ left: `${x}%` }} loading="lazy" decoding="async" />
        ))}
        {NOTAS.map(([p, cor, d], i) => (
          <span key={i} style={{ '--cor': cor, '--x0': `${FUNDO[p]}%`, '--x1': `${ACERTO[p]}%`, '--d': `${d}s` } as React.CSSProperties}>
            <i className="zt-nota" />
            <i className="zt-acerto" />
          </span>
        ))}
      </span>

      <span className="zt-conteudo">
        <span className="zt-selo">
          <i aria-hidden="true" />
          {aberto ? 'Jogo de ritmo · grátis' : 'Jogo de ritmo · em breve'}
        </span>
        <span className="zt-titulo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${UI}brasao.webp`} alt="" width={220} height={131} loading="lazy" decoding="async" />
          <b>
            Zelda <em>Tour</em>
          </b>
        </span>
        <span className="zt-sub">Toque as notas no ritmo das músicas de Zelda.</span>
        <span className="zt-cta">{aberto ? '▶ Jogar agora' : 'Ver novidades'}</span>
      </span>
    </Link>
  );
}
