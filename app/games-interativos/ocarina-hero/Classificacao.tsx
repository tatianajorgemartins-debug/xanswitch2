'use client';

// Classificação do Zelda Tour: o recorde de cada jogador, do maior pro menor.
// Os 5 primeiros ficam em destaque e o resto em "Ver mais". No menu dá pra
// trocar de música e de dificuldade; no resultado, mostra a que acabou de tocar.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAccessToken } from '@/lib/wishlist';
import { classificacaoAction, type LinhaClassificacao } from '../jogosActions';
import { DIFICULDADES, PRECISOES, chartNaDificuldade, dificuldadesDe, type Chart, type Dificuldade } from './ocarina';

const DESTAQUES = 5;
const MEDALHAS = ['#ffd23e', '#d7dde6', '#e49a5b', '#b98cff', '#b98cff'];

function Linha({ l }: { l: LinhaClassificacao }) {
  const top = l.posicao <= DESTAQUES;
  return (
    <li
      className={`oc-rank-linha${top ? ' is-top' : ''}${l.meu ? ' is-meu' : ''}`}
      style={top ? ({ '--medalha': MEDALHAS[l.posicao - 1] } as React.CSSProperties) : undefined}
    >
      <span className="oc-rank-pos">{l.posicao}</span>
      <span className="oc-rank-nome">
        {l.nome}
        {l.meu ? ' (você)' : ''}
        <small>{l.modo ? `Precisão ${PRECISOES[l.modo].nome} · ${l.precisao}%` : `${l.precisao}% de precisão`}</small>
      </span>
      <span className="oc-rank-pontos">{l.pontos.toLocaleString('pt-BR')}</span>
    </li>
  );
}

export function ListaClassificacao({ linhas, logado }: { linhas: LinhaClassificacao[]; logado: boolean }) {
  const [aberta, setAberta] = useState(false);
  const resto = linhas.slice(DESTAQUES);
  const minha = linhas.find((l) => l.meu);
  return (
    <>
      {linhas.length === 0 ? (
        <p className="oc-rank-aviso">Ninguém na classificação ainda. Termine a música e seja o primeiro!</p>
      ) : (
        <ol>
          {linhas.slice(0, DESTAQUES).map((l) => (
            <Linha key={l.posicao} l={l} />
          ))}
        </ol>
      )}
      {aberta && resto.length > 0 && (
        <ol className="oc-rank-resto" start={DESTAQUES + 1}>
          {resto.map((l) => (
            <Linha key={l.posicao} l={l} />
          ))}
        </ol>
      )}
      {resto.length > 0 && (
        <button type="button" className="oc-botao oc-rank-mais" aria-expanded={aberta} onClick={() => setAberta((v) => !v)}>
          {aberta ? 'Ver menos' : `Ver mais (${resto.length})`}
        </button>
      )}
      {minha && minha.posicao > DESTAQUES && !aberta && <p className="oc-rank-aviso">Sua posição: {minha.posicao}º lugar</p>}
      {!logado && (
        <p className="oc-rank-aviso">
          <Link href="/?conta=1">Entre na sua conta</Link> pra seus recordes aparecerem aqui.
        </p>
      )}
    </>
  );
}

export default function Classificacao({
  charts = [],
  chartId,
  titulo,
  versao = 0
}: {
  // Menu: as músicas que dá pra escolher.
  charts?: Chart[];
  // Resultado: a música e a dificuldade que acabaram de ser jogadas.
  chartId?: string;
  titulo?: string;
  versao?: number;
}) {
  const [musicaId, setMusicaId] = useState(charts[0]?.id ?? '');
  const musica = charts.find((c) => c.id === musicaId) ?? charts[0];
  const opcoes = musica ? dificuldadesDe(musica) : [];
  const [escolhida, setEscolhida] = useState<Dificuldade | null>(null);
  const dif = escolhida && opcoes.includes(escolhida) ? escolhida : opcoes[opcoes.length - 1];
  const id = chartId ?? (musica && dif ? chartNaDificuldade(musica, dif).id : '');

  const [dados, setDados] = useState<{ id: string; linhas: LinhaClassificacao[]; logado: boolean } | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    setErro(false);
    getAccessToken()
      .catch(() => null)
      .then((token) => classificacaoAction(token, id))
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setDados({ id, linhas: r.linhas, logado: r.logado });
        else setErro(true);
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [id, versao]);

  if (!id) return null;
  return (
    <section className="oc-rank" aria-label="Classificação dos jogadores">
      <h2>🏆 Classificação</h2>
      {chartId ? (
        <p className="oc-rank-musica">{titulo}</p>
      ) : (
        <div className="oc-rank-filtros">
          {charts.length > 1 ? (
            <select value={musica?.id} onChange={(e) => setMusicaId(e.target.value)} aria-label="Música da classificação">
              {charts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          ) : (
            <p className="oc-rank-musica">{musica?.titulo}</p>
          )}
          {opcoes.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === dif}
              className={d === dif ? 'is-on' : ''}
              style={{ '--dif': DIFICULDADES[d].cor } as React.CSSProperties}
              onClick={() => setEscolhida(d)}
            >
              {DIFICULDADES[d].nome}
            </button>
          ))}
        </div>
      )}
      {erro ? (
        <p className="oc-rank-aviso">A classificação não carregou agora. Tente de novo em instantes.</p>
      ) : dados?.id === id ? (
        <ListaClassificacao key={id} linhas={dados.linhas} logado={dados.logado} />
      ) : (
        <p className="oc-rank-aviso">Carregando a classificação…</p>
      )}
    </section>
  );
}
