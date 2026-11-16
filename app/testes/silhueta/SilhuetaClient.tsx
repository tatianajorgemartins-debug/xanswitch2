'use client';

// Tela do "Silhueta do Dia". Duas telas: escolher o nível e a partida.
// O desafio diário depende da data e do que está salvo no aparelho, então
// só aparece depois que a página carrega no navegador (no servidor sai um
// esqueleto).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { diaEm, formatarContador, msAteProximoDia, rngDe } from '@/lib/jogos/dia';
import { ativoEm, numeroDoDia } from '@/lib/jogos/sorteio';
import { normalizar, respostaConfere, sugestoes } from '@/lib/jogos/respostas';
import { registrarDiario, resultadoDoDia, sequenciaGeralHoje, statsDe } from '@/lib/jogos/progresso';
import { sequenciaHoje, type StatsModo } from '@/lib/jogos/sequencia';
import { compartilharTexto } from '@/lib/jogos/compartilhar';
import { ler, gravar } from '@/lib/jogos/armazenamento';
import { guardarPublicavel, registrarJogada } from '@/lib/jogos/registro';
import {
  INICIO,
  JOGO,
  NIVEIS,
  ajudas,
  eliminadasFacil,
  formatarTempo,
  franquiaNaLoja,
  imagemUrl,
  infoPersonagem,
  opcoesFacil,
  personagemDaResposta,
  personagemDoDia,
  personagemTreino,
  placar,
  recorteAtual,
  textoCompartilhar,
  tituloResultado,
  type Nivel,
  type NivelId,
  type Personagem
} from './silhueta';
import { analisarImagem, centroNoRecorte, escolherEnquadramento, posicaoNaMoldura, type Analise, type Enquadramento } from './recorte';
import './silhueta.css';

type Modo = 'diario' | 'treino';
type Tela = { tipo: 'niveis' } | { tipo: 'jogo'; nivel: NivelId; modo: Modo; personagem: Personagem; rodada: number };

const MENSAGENS_MARCO: Record<number, string> = {
  3: 'Três dias seguidos! Você pegou o ritmo.',
  7: 'Uma semana inteira sem faltar. Isso é dedicação de herói!',
  15: 'Quinze dias seguidos! Nem a Navi te para.',
  30: 'Um mês inteiro! Você é lenda da XAN Switch.'
};

export default function SilhuetaClient({
  personagens,
  franquiasLoja
}: {
  personagens: Personagem[];
  franquiasLoja: string[];
}) {
  // null até a página carregar no navegador.
  const [dia, setDia] = useState<string | null>(null);
  const [restante, setRestante] = useState(0);
  const [tela, setTela] = useState<Tela>({ tipo: 'niveis' });
  // Muda quando um resultado é salvo, pra reler o progresso.
  const [versao, setVersao] = useState(0);
  const [marco, setMarco] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = diaEm();
      setDia((antes) => (antes === d ? antes : d));
      setRestante(msAteProximoDia());
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  // Só no computador de teste (npm run dev): /testes/silhueta?ver=toad&nivel=dificil
  // abre um treino com esse personagem, pra conferir a imagem.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !dia) return;
    const q = new URLSearchParams(window.location.search);
    const p = personagens.find((x) => x.id === q.get('ver'));
    const nivel = (NIVEIS.find((n) => n.id === q.get('nivel'))?.id ?? 'facil') as NivelId;
    if (p) setTela({ tipo: 'jogo', nivel, modo: 'treino', personagem: p, rodada: 1 });
  }, [dia, personagens]);

  useEffect(() => {
    if (marco === null) return;
    const t = window.setTimeout(() => setMarco(null), 6000);
    return () => window.clearTimeout(t);
  }, [marco]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geral = useMemo(() => (dia ? sequenciaGeralHoje(dia) : { atual: 0, melhor: 0 }), [dia, versao]);

  function jogar(nivel: NivelId, modo: Modo, evitar?: string) {
    if (!dia) return;
    const personagem = modo === 'diario' ? personagemDoDia(personagens, nivel, dia) : personagemTreino(personagens, nivel, dia, evitar);
    if (!personagem) return;
    setTela((t) => ({ tipo: 'jogo', nivel, modo, personagem, rodada: (t.tipo === 'jogo' ? t.rodada : 0) + 1 }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="page-content sil-page">
      <div className="sil-topo">
        <Link href="/testes" className="sil-voltar">
          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Jogos
        </Link>
        <SequenciaGeral dias={geral.atual} />
      </div>

      <header className="sil-cabeca">
        <p className="sil-kicker">
          Desafio diário{dia && <> · #{numeroDoDia(dia, INICIO)}</>}
        </p>
        <h1 className="sil-titulo">
          Silhueta <em>do Dia</em>
        </h1>
        {tela.tipo === 'niveis' && (
          <p className="sil-sub">Quem é esse personagem? Um desafio novo por dia em cada nível, igual pra todo mundo.</p>
        )}
      </header>

      {marco !== null && (
        <div className="sil-marco" role="status">
          <span className="sil-marco-fogo" aria-hidden="true">
            🔥
          </span>
          <span>
            <strong>{marco} dias seguidos!</strong> {MENSAGENS_MARCO[marco] ?? 'Que sequência! Continue voltando todo dia.'}
          </span>
        </div>
      )}

      {!dia ? (
        <div className="sil-carregando" aria-hidden="true" />
      ) : tela.tipo === 'niveis' ? (
        <EscolherNivel dia={dia} versao={versao} restante={restante} onJogar={(n, m) => jogar(n, m)} />
      ) : (
        <Partida
          key={`${tela.nivel}-${tela.modo}-${tela.rodada}`}
          personagens={personagens}
          personagem={tela.personagem}
          nivel={NIVEIS.find((n) => n.id === tela.nivel)!}
          modo={tela.modo}
          dia={dia}
          restante={restante}
          sequenciaGeral={geral.atual}
          franquiaLoja={franquiaNaLoja(tela.personagem, franquiasLoja)}
          onSalvo={(novoMarco) => {
            setVersao((v) => v + 1);
            if (novoMarco) setMarco(novoMarco);
          }}
          onTreinar={() => jogar(tela.nivel, 'treino', tela.personagem.id)}
          onVoltar={() => setTela({ tipo: 'niveis' })}
        />
      )}
    </main>
  );
}

function SequenciaGeral({ dias }: { dias: number }) {
  return (
    <p className={`sil-seq${dias > 0 ? ' is-acesa' : ''}`} title="Sequência XAN: dias seguidos jogando algum desafio diário">
      <span className="sil-seq-fogo" aria-hidden="true">
        🔥
      </span>
      <strong>{dias}</strong>
      <span className="sil-seq-rotulo">{dias === 1 ? 'dia seguido' : 'dias seguidos'}</span>
    </p>
  );
}

// ---------- Escolher o nível ----------

function EscolherNivel({
  dia,
  versao,
  restante,
  onJogar
}: {
  dia: string;
  versao: number;
  restante: number;
  onJogar: (nivel: NivelId, modo: Modo) => void;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const feitos = useMemo(() => new Set(NIVEIS.filter((n) => resultadoDoDia(JOGO, n.id, dia)).map((n) => n.id)), [dia, versao]);
  const [nivelTreino, setNivelTreino] = useState<NivelId>('facil');
  return (
    <>
      <ul className="sil-niveis">
        {NIVEIS.map((n, i) => {
          const feito = feitos.has(n.id);
          return (
            <li key={n.id} style={{ '--i': i } as React.CSSProperties}>
              <button type="button" className={`sil-nivel nivel-${n.id}${feito ? ' is-feito' : ''}`} onClick={() => onJogar(n.id, 'diario')}>
                <span className="sil-nivel-marca" aria-hidden="true">
                  {Array.from({ length: i + 1 }, (_, k) => (
                    <span key={k} />
                  ))}
                </span>
                <span className="sil-nivel-nome">{n.nome}</span>
                <span className="sil-nivel-resumo">{n.resumo}</span>
                <span className="sil-nivel-pe">
                  {feito ? (
                    <span className="sil-nivel-ok">
                      <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Feito hoje · ver resultado
                    </span>
                  ) : (
                    <span className="sil-nivel-jogar">
                      {n.tentativas} tentativas · Jogar
                      <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor" aria-hidden="true">
                        <path d="M7 4.5v15l13-7.5z" />
                      </svg>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="sil-proximo">
        Novas silhuetas em <strong className="sil-contador">{formatarContador(restante)}</strong>
      </p>
      <div className="sil-treino">
        <p>
          <strong>Modo treino</strong> · personagens aleatórios, sem limite (não conta pra sequência)
        </p>
        <div className="sil-treino-linha">
          <select value={nivelTreino} onChange={(e) => setNivelTreino(e.target.value as NivelId)} aria-label="Nível do treino">
            {NIVEIS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nome}
              </option>
            ))}
          </select>
          <button type="button" className="sil-botao" onClick={() => onJogar(nivelTreino, 'treino')}>
            Treinar
          </button>
        </div>
      </div>
    </>
  );
}

// ---------- A partida ----------

type Resultado = { venceu: boolean; erros: string[]; tempo?: number };
// Partida diária em andamento (pra recarregar a página não zerar as tentativas).
type Andamento = { dia: string; nivel: NivelId; personagem: string; erros: string[]; inicio: number };
const CHAVE_ANDAMENTO = 'silhueta_andamento';

function Partida({
  personagens,
  personagem,
  nivel,
  modo,
  dia,
  restante,
  sequenciaGeral,
  franquiaLoja,
  onSalvo,
  onTreinar,
  onVoltar
}: {
  personagens: Personagem[];
  personagem: Personagem;
  nivel: Nivel;
  modo: Modo;
  dia: string;
  restante: number;
  sequenciaGeral: number;
  franquiaLoja: string | null;
  onSalvo: (marco: number | null) => void;
  onTreinar: () => void;
  onVoltar: () => void;
}) {
  const treino = modo === 'treino';
  // Já jogou o diário hoje? Volta direto no resultado.
  const [salvo] = useState<Resultado | null>(() => {
    if (treino) return null;
    const r = resultadoDoDia(JOGO, nivel.id, dia);
    if (!r) return null;
    const erros = r.detalhe?.erros;
    const tempo = r.detalhe?.tempo;
    return { venceu: r.venceu, erros: Array.isArray(erros) ? (erros as string[]) : [], tempo: typeof tempo === 'number' ? tempo : undefined };
  });
  // Partida do dia começada antes (a página foi recarregada no meio).
  const [andamento] = useState<Andamento | null>(() => {
    if (treino || salvo) return null;
    const a = ler<Andamento | null>(CHAVE_ANDAMENTO, null);
    return a && a.dia === dia && a.nivel === nivel.id && a.personagem === personagem.id && Array.isArray(a.erros) ? a : null;
  });
  const [erros, setErros] = useState<string[]>(salvo?.erros ?? andamento?.erros ?? []);
  const [fim, setFim] = useState<Resultado | null>(salvo);
  const [stats, setStats] = useState<StatsModo | null>(() => (treino ? null : statsDe(JOGO, nivel.id)));
  const [aviso, setAviso] = useState<string | null>(null);
  const inicio = useRef(andamento?.inicio ?? Date.now());
  const [agora, setAgora] = useState(() => Date.now());

  // Cronômetro (Insano).
  useEffect(() => {
    if (!nivel.cronometro || fim) return;
    const t = window.setInterval(() => setAgora(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [nivel.cronometro, fim]);
  const tempoMs = fim?.tempo ?? agora - inicio.current;

  // A imagem: tamanho e onde tem figura (pro recorte).
  const [analise, setAnalise] = useState<Analise | null>(null);
  useEffect(() => {
    let vivo = true;
    analisarImagem(imagemUrl(personagem, 'silhueta'))
      .then((a) => vivo && setAnalise(a))
      .catch(() => vivo && setAnalise({ w: 1, h: 1, grade: new Uint8Array(1), gw: 1, gh: 1 }));
    return () => {
      vivo = false;
    };
  }, [personagem]);
  const fInicial = nivel.recortes?.[0] ?? 1;
  const enquadramento = useMemo<Enquadramento | null>(() => {
    if (!analise) return null;
    const rng = treino ? Math.random : rngDe(`${JOGO}:${nivel.id}:recorte:${dia}`);
    return escolherEnquadramento(analise, fInicial, rng, Boolean(nivel.embaralhado));
  }, [analise, treino, nivel, dia, fInicial]);

  const opcoes = useMemo(
    () => (nivel.resposta === 'opcoes' ? opcoesFacil(personagens, personagem, dia, treino) : []),
    [nivel.resposta, personagens, personagem, dia, treino]
  );
  const [eliminadas, setEliminadas] = useState<string[]>(() =>
    nivel.resposta === 'opcoes' && (andamento?.erros.length ?? 0) >= 2 ? eliminadasFacil(opcoes, personagem.nome, andamento!.erros.slice(0, 2), dia, false) : []
  );

  const nomesValidos = useMemo(() => personagens.filter((p) => ativoEm(p, dia)).map((p) => p.nome), [personagens, dia]);

  function terminar(venceu: boolean, listaErros: string[]) {
    const tempo = nivel.cronometro ? Date.now() - inicio.current : undefined;
    const r: Resultado = { venceu, erros: listaErros, tempo };
    setFim(r);
    const resumo = `${placar({ nivel, erros: listaErros.length, venceu, tempo: tempo ? formatarTempo(tempo) : undefined })} · ${personagem.nome}`;
    registrarJogada({
      jogo: JOGO,
      modo: treino ? `treino-${nivel.id}` : nivel.id,
      dia: treino ? null : dia,
      venceu,
      pontos: venceu ? listaErros.length + 1 : null,
      resumo,
      detalhes: { personagem: personagem.id, erros: listaErros, ...(tempo ? { tempo } : {}) }
    });
    if (treino) return;
    gravar(CHAVE_ANDAMENTO, null);
    const salvoAgora = registrarDiario(JOGO, nivel.id, {
      dia,
      venceu,
      tentativas: venceu ? listaErros.length + 1 : nivel.tentativas,
      detalhe: { personagem: personagem.id, erros: listaErros, ...(tempo ? { tempo } : {}) }
    });
    setStats(salvoAgora.stats);
    onSalvo(salvoAgora.marco);
    guardarPublicavel({
      id: `${JOGO}:${nivel.id}:${dia}`,
      jogo: JOGO,
      modo: nivel.id,
      titulo: tituloResultado(numeroDoDia(dia, INICIO), nivel),
      resultado: placar({ nivel, erros: listaErros.length, venceu, tempo: tempo ? formatarTempo(tempo) : undefined })
    });
  }

  function errar(nome: string) {
    const novos = [...erros, nome];
    setErros(novos);
    if (novos.length >= nivel.tentativas) {
      terminar(false, novos);
      return;
    }
    if (!treino) gravar(CHAVE_ANDAMENTO, { dia, nivel: nivel.id, personagem: personagem.id, erros: novos, inicio: inicio.current } satisfies Andamento);
    if (nivel.resposta === 'opcoes' && novos.length === 2) setEliminadas(eliminadasFacil(opcoes, personagem.nome, novos, dia, treino));
  }

  // Fácil: clicou numa opção.
  function escolher(nome: string) {
    if (fim || erros.includes(nome) || eliminadas.includes(nome)) return;
    if (normalizar(nome) === normalizar(personagem.nome)) terminar(true, erros);
    else errar(nome);
  }

  // Médio, Difícil, Insano: digitou um nome. Devolve o aviso (ou null).
  function responder(textoDigitado: string): string | null {
    if (fim) return null;
    if (respostaConfere(textoDigitado, personagem)) {
      terminar(true, erros);
      return null;
    }
    const quem = personagemDaResposta(personagens, textoDigitado);
    if (!quem) return 'Esse nome não está no jogo. Escolha um da lista de sugestões.';
    if (erros.some((e) => normalizar(e) === normalizar(quem.nome))) return `Você já tentou ${quem.nome}.`;
    errar(quem.nome);
    return null;
  }

  // Teclas 1 a 6 escolhem a opção (Fácil).
  useEffect(() => {
    if (fim || nivel.resposta !== 'opcoes') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= opcoes.length) escolher(opcoes[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A revelação em cores começa logo depois que a partida acaba.
  const [revelado, setRevelado] = useState(Boolean(salvo));
  useEffect(() => {
    if (fim && !revelado) {
      const t = window.setTimeout(() => setRevelado(true), 60);
      return () => window.clearTimeout(t);
    }
  }, [fim, revelado]);

  const ajuda = ajudas(nivel, personagem, erros.length);
  const f = fim ? 1 : recorteAtual(nivel, erros.length);
  const tentativaAtual = Math.min(erros.length + 1, nivel.tentativas);
  const numero = numeroDoDia(dia, INICIO);

  async function compartilhar() {
    if (!fim) return;
    const texto = textoCompartilhar({
      numero,
      nivel,
      erros: fim.erros.length,
      venceu: fim.venceu,
      sequencia: Math.max(sequenciaGeral, 1),
      tempo: fim.tempo ? formatarTempo(fim.tempo) : undefined
    });
    const como = await compartilharTexto(texto);
    setAviso(como === 'copiado' ? 'Resultado copiado! Cole no Instagram ou no WhatsApp.' : como === 'falhou' ? 'Não deu pra copiar. Tente de novo.' : null);
  }

  return (
    <section className={`sil-partida nivel-${nivel.id}`} aria-label={`Silhueta do Dia, nível ${nivel.nome}`}>
      <div className="sil-partida-barra">
        <button type="button" className="sil-chip-voltar" onClick={onVoltar}>
          <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Níveis
        </button>
        <span className={`sil-chip-nivel nivel-${nivel.id}`}>{nivel.nome}</span>
        {treino && <span className="sil-chip-treino">Treino · não conta</span>}
        {nivel.cronometro && (
          <span className="sil-cronometro" aria-label={`Tempo: ${formatarTempo(tempoMs)}`}>
            ⏱️ {formatarTempo(tempoMs)}
          </span>
        )}
        <span className="sil-vidas" aria-label={fim ? 'Partida encerrada' : `Tentativa ${tentativaAtual} de ${nivel.tentativas}`}>
          {Array.from({ length: nivel.tentativas }, (_, i) => (
            <span key={i} className={i < erros.length ? 'is-erro' : fim?.venceu && i === erros.length ? 'is-acerto' : ''} aria-hidden="true" />
          ))}
        </span>
      </div>

      <div className={`sil-palco${fim ? ' is-fim' : ''}${revelado ? ' is-revelado' : ''}${fim?.venceu ? ' is-venceu' : ''}`}>
        <span className="sil-palco-raios" aria-hidden="true" />
        <span
          className={`sil-moldura${f < 1 ? ' is-recorte' : ''}${nivel.embaralhado && !fim ? ' is-embaralhado' : ''}`}
          role="img"
          aria-label={fim ? personagem.nome : f < 1 ? 'Pedaço da silhueta de um personagem misterioso' : 'Silhueta de um personagem misterioso'}
        >
          {analise && enquadramento && (
            <>
              <Figura src={imagemUrl(personagem, 'silhueta')} analise={analise} enq={enquadramento} f={f} fInicial={fInicial} fim={Boolean(fim)} className="sil-img-sombra" />
              {(fim || ajuda.cor > 0) && (
                <Figura
                  src={imagemUrl(personagem, 'cor')}
                  analise={analise}
                  enq={enquadramento}
                  f={f}
                  fInicial={fInicial}
                  fim={Boolean(fim)}
                  className="sil-img-cor"
                  style={!fim ? { opacity: ajuda.cor } : undefined}
                />
              )}
            </>
          )}
          {nivel.embaralhado && !fim && <span className="sil-ruido" aria-hidden="true" />}
        </span>
        {fim && <span className="sil-palco-brilho" aria-hidden="true" />}
        <span className="sil-palco-pergunta" aria-hidden="true">
          {fim ? (fim.venceu ? 'Isso!' : 'Era…') : f < 1 ? 'Quem é? (zoom)' : 'Quem é?'}
        </span>
      </div>

      {!fim && (ajuda.textos.length > 0 || eliminadas.length > 0 || ajuda.cor > 0) && (
        <ul className="sil-dicas" aria-live="polite">
          {ajuda.textos.map((d) => (
            <li key={d.rotulo}>
              <span>{d.rotulo}</span>
              <strong>{d.valor}</strong>
            </li>
          ))}
          {eliminadas.length > 0 && (
            <li>
              <span>Dica</span>
              <strong>tiramos 2 opções erradas</strong>
            </li>
          )}
          {ajuda.cor > 0 && (
            <li>
              <span>Dica</span>
              <strong>um pouco de cor na imagem</strong>
            </li>
          )}
        </ul>
      )}

      {!fim && erros.length > 0 && nivel.resposta === 'digitar' && (
        <ul className="sil-tentativas" aria-label="Suas tentativas">
          {erros.map((e) => (
            <li key={e}>✕ {e}</li>
          ))}
        </ul>
      )}

      {!fim && nivel.resposta === 'opcoes' && (
        <div className="sil-opcoes" role="group" aria-label="Escolha o personagem">
          {opcoes.map((o, i) => {
            const errada = erros.includes(o);
            const fora = eliminadas.includes(o);
            return (
              <button
                key={o}
                type="button"
                className={`sil-opcao${errada ? ' is-errada' : ''}${fora ? ' is-fora' : ''}`}
                disabled={errada || fora}
                onClick={() => escolher(o)}
              >
                <span className="sil-opcao-tecla" aria-hidden="true">
                  {i + 1}
                </span>
                {o}
              </button>
            );
          })}
        </div>
      )}

      {!fim && nivel.resposta === 'digitar' && <CampoResposta nomes={nomesValidos} onEnviar={responder} />}

      {fim && (
        <div className="sil-resultado">
          <p className={`sil-resultado-titulo${fim.venceu ? ' is-venceu' : ''}`}>
            {fim.venceu ? (fim.erros.length === 0 ? 'Acertou de primeira!' : `Acertou na ${fim.erros.length + 1}ª tentativa!`) : 'Não foi dessa vez'}
            {fim.tempo ? ` · ⏱️ ${formatarTempo(fim.tempo)}` : ''}
          </p>
          <p className="sil-resultado-nome">{personagem.nome}</p>
          <p className="sil-resultado-info">{infoPersonagem(personagem)}</p>

          <div className="sil-acoes">
            {!treino && (
              <button type="button" className="sil-botao is-principal" onClick={compartilhar}>
                <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
                  <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Compartilhar
              </button>
            )}
            {!treino && (
              <Link className="sil-botao" href={`/testes/feed?publicar=${encodeURIComponent(`${JOGO}:${nivel.id}:${dia}`)}`}>
                📣 Publicar no feed
              </Link>
            )}
            <button type="button" className={`sil-botao${treino ? ' is-principal' : ''}`} onClick={onTreinar}>
              {treino ? 'Próximo personagem' : 'Treinar mais'}
            </button>
          </div>
          {aviso && (
            <p className="sil-aviso" role="status">
              {aviso}
            </p>
          )}
          {franquiaLoja && (
            <Link className="sil-loja" href={`/franquia/${encodeURIComponent(franquiaLoja)}`}>
              Ver jogos de {franquiaLoja} na loja →
            </Link>
          )}

          {!treino && stats && <Estatisticas stats={stats} nivel={nivel} dia={dia} atual={fim} />}
          {!treino && (
            <p className="sil-proximo">
              Próxima silhueta em <strong className="sil-contador">{formatarContador(restante)}</strong>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// A imagem dentro da moldura quadrada, no recorte, giro e espelho da vez.
function Figura({
  src,
  analise,
  enq,
  f,
  fInicial,
  fim,
  className,
  style
}: {
  src: string;
  analise: Analise;
  enq: Enquadramento;
  f: number;
  fInicial: number;
  fim: boolean;
  className: string;
  style?: React.CSSProperties;
}) {
  const centro = fim ? { u: 0.5, v: 0.5 } : centroNoRecorte(enq, f, fInicial);
  const pos = posicaoNaMoldura(analise, f, centro.u, centro.v);
  const giro = fim ? 0 : enq.giro;
  const espelho = !fim && enq.espelho;
  return (
    <span className={`sil-camada ${className}`} style={{ transform: `rotate(${giro}deg) scaleX(${espelho ? -1 : 1})`, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        style={{ width: `${pos.largura}%`, height: `${pos.altura}%`, left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
      />
    </span>
  );
}

// Campo de digitar o nome, com autocompletar (setas + Enter no teclado).
function CampoResposta({ nomes, onEnviar }: { nomes: string[]; onEnviar: (texto: string) => string | null }) {
  const [texto, setTexto] = useState('');
  const [ativo, setAtivo] = useState(-1);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idLista = useId();
  const lista = useMemo(() => sugestoes(texto, nomes, 6), [texto, nomes]);
  const campo = useRef<HTMLInputElement>(null);

  function enviar(valor: string) {
    if (!valor.trim()) return;
    const msg = onEnviar(valor);
    setErro(msg);
    if (!msg) setTexto('');
    setAberto(false);
    setAtivo(-1);
    campo.current?.focus();
  }

  return (
    <form
      className="sil-campo"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(aberto && ativo >= 0 && lista[ativo] ? lista[ativo] : texto);
      }}
    >
      <div className="sil-campo-linha">
        <input
          ref={campo}
          type="text"
          value={texto}
          placeholder="Digite o nome do personagem"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          role="combobox"
          aria-label="Nome do personagem"
          aria-expanded={aberto && lista.length > 0}
          aria-controls={idLista}
          aria-activedescendant={aberto && ativo >= 0 ? `${idLista}-${ativo}` : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
            setAtivo(-1);
            setErro(null);
          }}
          onBlur={() => window.setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => {
            if (!lista.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAberto(true);
              setAtivo((a) => (a + 1) % lista.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAtivo((a) => (a <= 0 ? lista.length - 1 : a - 1));
            } else if (e.key === 'Escape') {
              setAberto(false);
            }
          }}
        />
        <button type="submit" className="sil-botao is-principal" disabled={!texto.trim()}>
          Chutar
        </button>
      </div>
      {aberto && lista.length > 0 && (
        <ul className="sil-sugestoes" id={idLista} role="listbox">
          {lista.map((n, i) => (
            <li
              key={n}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === ativo}
              className={i === ativo ? 'is-ativo' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                enviar(n);
              }}
            >
              {n}
            </li>
          ))}
        </ul>
      )}
      {erro && (
        <p className="sil-campo-erro" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}

function Estatisticas({ stats, nivel, dia, atual }: { stats: StatsModo; nivel: Nivel; dia: string; atual: Resultado }) {
  const chaves = [...Array.from({ length: nivel.tentativas }, (_, i) => String(i + 1)), 'X'];
  const maior = Math.max(1, ...chaves.map((k) => stats.distribuicao[k] ?? 0));
  const destaque = atual.venceu ? String(atual.erros.length + 1) : 'X';
  const numeros = [
    { v: stats.partidas, r: 'Jogos' },
    { v: stats.partidas ? Math.round((stats.vitorias / stats.partidas) * 100) : 0, r: '% vitórias' },
    { v: sequenciaHoje(stats.sequencia, dia), r: 'Sequência' },
    { v: stats.sequencia.melhor, r: 'Melhor' }
  ];
  return (
    <div className="sil-stats">
      <p className="sil-stats-titulo">Suas estatísticas · {nivel.nome}</p>
      <dl className="sil-stats-numeros">
        {numeros.map((n) => (
          <div key={n.r}>
            <dt>{n.r}</dt>
            <dd>{n.v}</dd>
          </div>
        ))}
      </dl>
      <ol className="sil-stats-barras" aria-label="Em quantas tentativas você acerta">
        {chaves.map((k) => {
          const v = stats.distribuicao[k] ?? 0;
          return (
            <li key={k} className={k === destaque ? 'is-hoje' : ''}>
              <span className="sil-stats-k">{k === 'X' ? '✕' : k}</span>
              <span className="sil-stats-barra" style={{ '--p': `${Math.max(8, (v / maior) * 100)}%` } as React.CSSProperties}>
                {v}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
