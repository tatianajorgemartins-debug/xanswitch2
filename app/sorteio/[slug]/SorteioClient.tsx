'use client';

// Página do participante (/sorteio/<slug>). O sorteio tem vários itens,
// cada um com as próprias inscrições e a sua hora de sortear. A pessoa
// entra com a conta da loja, coloca o @ do Instagram, aceita o regulamento
// e escolhe de quais itens participa. Quando um item é sorteado, a página
// mostra a roleta ao vivo (só assistindo). Visual em ../sorteio.css.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import {
  getAccessToken,
  getCurrentUser,
  getInstagramHandle,
  onAuthChange,
  saveInstagramHandle,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  translateAuthError
} from '@/lib/wishlist';
import { NOME_STATUS, normalizarInstagram } from '@/lib/sorteio/regras';
import type { EstadoPublico, PremioPublico } from '@/lib/sorteio/estado';
import { confirmarPresencaAction, minhaParticipacaoAction } from '../actions';
import { ListaPremios, PainelAoVivo, VoceGanhou, buscarEstadoPublico, quando, sorteioAtual, useEstadoSorteio } from '../AoVivo';

const CHAVE_DISPOSITIVO = 'xan_sorteio_dispositivo';

function lerDispositivo(): string | null {
  try {
    return localStorage.getItem(CHAVE_DISPOSITIVO);
  } catch {
    return null;
  }
}

// Número que sobe até o valor (e acompanha quando ele muda).
function useNumeroAnimado(alvo: number) {
  const [valor, setValor] = useState(alvo);
  const atual = useRef(alvo);
  const primeira = useRef(true);
  useEffect(() => {
    const de = primeira.current ? 0 : atual.current;
    primeira.current = false;
    if (de === alvo) return;
    const inicio = performance.now();
    const dur = Math.min(1400, 400 + Math.abs(alvo - de) * 8);
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - inicio) / dur);
      const v = Math.round(de + (alvo - de) * (1 - Math.pow(1 - k, 4)));
      atual.current = v;
      setValor(v);
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  return valor;
}

type Inscricao = { premioId: number; codigo: string };

export default function SorteioClient({ inicial, previa = false }: { inicial: EstadoPublico; previa?: boolean }) {
  const slug = inicial.sorteio.slug;
  const buscar = useMemo(() => buscarEstadoPublico(slug), [slug]);
  const { estado, diferenca, falhou } = useEstadoSorteio(buscar, inicial);
  const e = estado ?? inicial;

  // Conta, inscrições e o cadastro (@ + regulamento), que vale pra todos os itens.
  const [user, setUser] = useState<User | null>(null);
  const [pronto, setPronto] = useState(false);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [instagram, setInstagram] = useState('');
  const [instaSalvo, setInstaSalvo] = useState<string | null>(null);
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState<number[] | null>(null);
  const [erros, setErros] = useState<Record<number, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [lembrete, setLembrete] = useState(false);
  const cadastro = useRef<HTMLElement>(null);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {})
      .finally(() => setPronto(true));
    return onAuthChange(setUser);
  }, []);
  useEffect(() => {
    setInscricoes([]);
    if (!user) return;
    let vivo = true;
    getAccessToken()
      .then((t) => minhaParticipacaoAction(t, slug))
      .then((m) => vivo && setInscricoes(m.itens))
      .catch(() => {});
    // Quem já salvou o @ na conta da loja não precisa digitar de novo.
    getInstagramHandle()
      .then((h) => {
        if (vivo && h) {
          setInstaSalvo(h);
          setInstagram((atual) => atual || h);
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user, slug]);

  const status = e.sorteio.status;
  const publicado = status === 'abertas';
  const participantes = useNumeroAnimado(e.participantes);
  const palavras = e.sorteio.titulo.trim().split(/\s+/);
  const normalizado = normalizarInstagram(instagram);
  const cadastroOk = user !== null && normalizado !== null && aceito;
  const inscrito = (id: number) => inscricoes.some((i) => i.premioId === id);
  const abertos = e.premios.filter((p) => publicado && p.status === 'abertas');
  const faltam = abertos.filter((p) => !inscrito(p.id));
  // O palco da roleta aparece quando tem sorteio rodando ou item pronto pra sortear.
  const prontoPraSortear = e.premios.some((p) => p.status === 'encerradas' && e.sorteios.filter((x) => x.premioId === p.id).length < p.ganhadores);
  const mostrarPalco = publicado && (prontoPraSortear || sorteioAtual(e, Date.now() + diferenca) !== null);

  async function participar(ids: number[]) {
    if (!cadastroOk || !normalizado) {
      setLembrete(true);
      cadastro.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setEnviando(ids);
    setErroGeral(null);
    setErros((atual) => Object.fromEntries(Object.entries(atual).filter(([k]) => !ids.includes(Number(k)))));
    const token = await getAccessToken().catch(() => null);
    const r = await confirmarPresencaAction(token, slug, ids, aceito, lerDispositivo(), normalizado).catch(() => ({
      ok: false as const,
      erro: 'A conexão falhou. Tente de novo.'
    }));
    setEnviando(null);
    if (!r.ok) {
      setErroGeral(r.erro);
      return;
    }
    try {
      localStorage.setItem(CHAVE_DISPOSITIVO, r.dispositivo);
    } catch {
      // sem armazenamento: o cookie do aparelho já vale
    }
    setInscricoes((atual) => [...atual.filter((i) => !r.inscritos.some((n) => n.premioId === i.premioId)), ...r.inscritos]);
    setErros((atual) => ({ ...atual, ...Object.fromEntries(r.erros.map((x) => [x.premioId, x.erro])) }));
    // Guarda o @ na conta da loja também (se mudou).
    if (r.inscritos.length && instaSalvo !== normalizado) {
      saveInstagramHandle(normalizado)
        .then(() => setInstaSalvo(normalizado))
        .catch(() => {});
    }
  }

  function botaoDoItem(p: PremioPublico) {
    if (inscrito(p.id)) return <span className="sorteio-selo-ok is-pequeno">✔ Participando</span>;
    if (!publicado || p.status === 'em_breve') {
      return <span className="sorteio-premio-aviso">Inscrições abrem em breve</span>;
    }
    if (p.status === 'encerradas') return <span className="sorteio-premio-aviso">Inscrições encerradas</span>;
    return (
      <>
        <button type="button" className="sorteio-botao is-item" disabled={enviando !== null} onClick={() => participar([p.id])}>
          {enviando?.includes(p.id) ? 'Inscrevendo…' : 'Participar'}
        </button>
        {erros[p.id] && (
          <p className="sorteio-erro" role="alert">
            {erros[p.id]}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="sorteio-ui sorteio-pagina">
      <div className="sorteio-brilho" aria-hidden="true" />
      <header className="sorteio-barra">
        <Link href="/" className="sorteio-logo" aria-label="XAN Switch: voltar pra loja">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="XAN Switch" />
        </Link>
        <span className={`sorteio-pilula${publicado ? ' is-vivo' : ''}`}>
          {publicado && <i className="sorteio-ponto" />}
          {publicado ? (abertos.length ? 'Inscrições abertas' : 'Ao vivo') : NOME_STATUS[status]}
        </span>
      </header>

      {previa && (
        <p className="sorteio-faixa">
          Prévia do admin: o público ainda não vê esta página. Ela abre quando você publicar o sorteio.
        </p>
      )}

      <main className="sorteio-conteudo">
        <section className="sorteio-hero">
          {e.sorteio.banner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sorteio-banner" src={e.sorteio.banner} alt="" />
          )}
          <span className="sorteio-rotulo sorteio-entra" style={{ '--i': 0 } as React.CSSProperties}>
            Sorteio ao vivo · XAN Switch
          </span>
          <h1 className="sorteio-titulo">
            {palavras.map((p, i) => (
              <span key={i} className={`sorteio-palavra${i === palavras.length - 1 ? ' is-destaque' : ''}`} style={{ '--i': i + 1 } as React.CSSProperties}>
                {p}{' '}
              </span>
            ))}
          </h1>
          {e.sorteio.descricao && (
            <p className="sorteio-descricao sorteio-entra" style={{ '--i': palavras.length + 1 } as React.CSSProperties}>
              {e.sorteio.descricao}
            </p>
          )}
          <div className="sorteio-hero-meta sorteio-entra" style={{ '--i': palavras.length + 2 } as React.CSSProperties}>
            <div className="sorteio-contador" aria-live="polite">
              <strong>{participantes.toLocaleString('pt-BR')}</strong>
              <span>{e.participantes === 1 ? 'pessoa participando' : 'pessoas participando'}</span>
            </div>
            <div className="sorteio-contador is-data">
              <strong>{e.premios.length}</strong>
              <span>{e.premios.length === 1 ? 'item pra sortear' : 'itens pra sortear'}</span>
            </div>
            {e.sorteio.data && (
              <div className="sorteio-contador is-data">
                <strong aria-hidden="true">📅</strong>
                <span>{quando(e.sorteio.data)}</span>
              </div>
            )}
          </div>
          {falhou && <p className="sorteio-faixa is-erro">Sem conexão. Tentando de novo…</p>}
        </section>

        {mostrarPalco ? (
          <PainelAoVivo estado={e} diferenca={diferenca} meusCodigos={inscricoes.map((i) => i.codigo)} mostrarGanhadores={false} />
        ) : (
          <VoceGanhou estado={e} agora={Date.now() + diferenca} meusCodigos={inscricoes.map((i) => i.codigo)} />
        )}

        {status !== 'finalizado' && (
          <section
            ref={cadastro}
            className={`sorteio-cartao sorteio-participar sorteio-entra${lembrete && !cadastroOk ? ' is-lembrete' : ''}`}
            style={{ '--i': palavras.length + 3 } as React.CSSProperties}
          >
            {!pronto ? (
              <p className="sorteio-carregando">Carregando…</p>
            ) : (
              <>
                <Passos atual={!user ? 1 : !normalizado || !aceito ? 2 : 3} />
                {!user ? (
                  <Entrar />
                ) : (
                  <div className="sorteio-confirmar">
                    <p className="sorteio-conta">
                      Entrou como <strong>{user.email}</strong> ·{' '}
                      <button type="button" className="sorteio-link" onClick={() => signOut().catch(() => {})}>
                        trocar de conta
                      </button>
                    </p>
                    <CampoInstagram valor={instagram} onChange={setInstagram} />
                    <label className="sorteio-aceite">
                      <input type="checkbox" checked={aceito} onChange={(ev) => setAceito(ev.target.checked)} />
                      <span>
                        Aceito o <a href="#regulamento">regulamento</a> do sorteio
                      </span>
                    </label>
                    {cadastroOk ? (
                      faltam.length > 1 ? (
                        <button type="button" className="sorteio-botao" disabled={enviando !== null} onClick={() => participar(faltam.map((p) => p.id))}>
                          {enviando && enviando.length > 1 ? 'Inscrevendo…' : `Participar de todos os ${faltam.length} itens abertos`}
                        </button>
                      ) : (
                        <p className="sorteio-dica">
                          {faltam.length === 1
                            ? '👇 Agora é só tocar em "Participar" no item abaixo.'
                            : abertos.length
                              ? '✔ Você está em todos os itens abertos. Boa sorte!'
                              : 'Nenhum item com inscrições abertas agora. Volte daqui a pouco!'}
                        </p>
                      )
                    ) : (
                      <p className="sorteio-dica">Preencha o @ e aceite o regulamento. Depois escolha os itens abaixo.</p>
                    )}
                  </div>
                )}
                {erroGeral && (
                  <p className="sorteio-erro" role="alert">
                    {erroGeral}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        <section className="sorteio-secao">
          <h2 className="sorteio-titulo-secao">
            <span className="sorteio-rotulo">Escolha do que participar</span>
            {e.premios.length === 1 ? 'Item do sorteio' : 'Itens do sorteio'}
          </h2>
          <ListaPremios estado={e} acao={status === 'finalizado' ? undefined : botaoDoItem} agora={Date.now() + diferenca} />
        </section>

        {e.sorteios.length > 0 && (
          <section className="sorteio-secao">
            <PainelGanhadores estado={e} diferenca={diferenca} meusCodigos={inscricoes.map((i) => i.codigo)} />
          </section>
        )}

        {e.sorteio.regulamento && (
          <details className="sorteio-regulamento" id="regulamento">
            <summary>Regulamento</summary>
            <div className="sorteio-regulamento-texto">{e.sorteio.regulamento}</div>
          </details>
        )}
      </main>
    </div>
  );
}

// Só a lista de ganhadores (o palco fica lá em cima).
function PainelGanhadores({ estado, diferenca, meusCodigos }: { estado: EstadoPublico; diferenca: number; meusCodigos: string[] }) {
  const [, setTique] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTique((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const agora = Date.now() + diferenca;
  const feitos = estado.sorteios.filter((s) => s.id > 0 && agora >= s.inicio + s.duracao);
  if (!feitos.length) return null;
  const premioDe = (id: number) => estado.premios.find((p) => p.id === id);
  return (
    <>
      <h2 className="sorteio-titulo-secao">
        <span className="sorteio-rotulo">Quem já levou</span>
        Ganhadores
      </h2>
      <ol className="sorteio-ganhadores">
        {feitos.map((s, i) => {
          const premio = premioDe(s.premioId);
          const meu = meusCodigos.includes(s.ganhador.codigo);
          return (
            <li key={s.id} className={meu ? 'is-meu' : undefined} style={{ '--i': i } as React.CSSProperties}>
              <span className="sorteio-carta-avatar">{s.ganhador.nome.slice(0, 2).toUpperCase()}</span>
              <span className="sorteio-ganhador-info">
                <strong>
                  {s.ganhador.nome}
                  {meu && <em className="sorteio-pilula is-ouro">Você</em>}
                </strong>
                <span className="sorteio-ganhador-email">{s.ganhador.email}</span>
              </span>
              <span className="sorteio-ganhador-premio">
                {premio?.imagem && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={premio.imagem} alt="" />
                )}
                {premio?.nome ?? 'Item'}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Passos({ atual }: { atual: number }) {
  const nomes = ['Entrar na conta', 'Instagram e regulamento', 'Escolher os itens'];
  return (
    <ol className="sorteio-passos" aria-label="Como participar">
      {nomes.map((n, i) => (
        <li key={n} className={i + 1 < atual ? 'is-feito' : i + 1 === atual ? 'is-atual' : undefined}>
          <span>{i + 1 < atual ? '✓' : i + 1}</span>
          {n}
        </li>
      ))}
    </ol>
  );
}

function CampoInstagram({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const invalido = valor.trim() !== '' && !normalizarInstagram(valor);
  return (
    <label className="sorteio-campo">
      <span>@ do seu Instagram</span>
      <span className={`sorteio-campo-insta${invalido ? ' is-erro' : ''}`}>
        <b aria-hidden="true">@</b>
        <input
          value={valor}
          onChange={(ev) => onChange(ev.target.value)}
          placeholder="seu.usuario"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={60}
          aria-invalid={invalido}
        />
      </span>
      <small>{invalido ? 'Só letras, números, ponto e _ (até 30).' : 'É por ele que a gente fala com você se ganhar.'}</small>
    </label>
  );
}

// Entrar com a mesma conta da loja (sem sair da página do sorteio).
function Entrar() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      if (modo === 'entrar') await signIn(email.trim(), senha);
      else {
        const { confirmedImmediately } = await signUp(email.trim(), senha);
        if (!confirmedImmediately) setErro('Conta criada. Confirme pelo link que chegou no seu e-mail e volte aqui.');
      }
    } catch (err) {
      setErro(translateAuthError(err instanceof Error ? err.message : ''));
    }
    setEnviando(false);
  }

  return (
    <div className="sorteio-entrar">
      <p className="sorteio-entrar-texto">Entre com a sua conta da XAN Switch pra participar. Leva menos de um minuto.</p>
      <button type="button" className="sorteio-botao is-claro" onClick={() => signInWithGoogle().catch(() => setErro('Não deu pra entrar com o Google.'))}>
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Entrar com o Google
      </button>
      <p className="sorteio-ou">
        <span>ou com e-mail</span>
      </p>
      <form onSubmit={enviar} className="sorteio-form">
        <label className="sorteio-campo">
          <span>E-mail</span>
          <input type="email" autoComplete="email" required value={email} onChange={(ev) => setEmail(ev.target.value)} />
        </label>
        <label className="sorteio-campo">
          <span>Senha</span>
          <input
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={senha}
            onChange={(ev) => setSenha(ev.target.value)}
          />
        </label>
        <button type="submit" className="sorteio-botao" disabled={enviando}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      <button type="button" className="sorteio-link" onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}>
        {modo === 'entrar' ? 'Não tem conta? Criar conta' : 'Já tenho conta. Entrar'}
      </button>
      {erro && (
        <p className="sorteio-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
