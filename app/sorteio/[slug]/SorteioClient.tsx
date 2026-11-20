'use client';

// Página do participante (/sorteio/<slug>): entra com a conta da loja,
// coloca o @ do Instagram, confirma presença e, quando o sorteio começa,
// acompanha a roleta e os ganhadores ao vivo (só assistindo). O visual fica
// em ../sorteio.css.
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
import type { EstadoPublico } from '@/lib/sorteio/estado';
import { confirmarPresencaAction, minhaParticipacaoAction, type MinhaParticipacao } from '../actions';
import { Confete, ListaPremios, PainelAoVivo, buscarEstadoPublico, useEstadoSorteio } from '../AoVivo';

const CHAVE_DISPOSITIVO = 'xan_sorteio_dispositivo';

function lerDispositivo(): string | null {
  try {
    return localStorage.getItem(CHAVE_DISPOSITIVO);
  } catch {
    return null;
  }
}

// "2026-12-11T00:00:00Z" → "qui., 11 de dez. · 21h"
function dataDaLive(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: 'numeric', month: 'short' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).replace(':00', 'h');
  return `${dia} · ${hora}`;
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

export default function SorteioClient({ inicial, previa = false }: { inicial: EstadoPublico; previa?: boolean }) {
  const slug = inicial.sorteio.slug;
  const buscar = useMemo(() => buscarEstadoPublico(slug), [slug]);
  const { estado, diferenca, falhou } = useEstadoSorteio(buscar, inicial);
  const e = estado ?? inicial;

  const [user, setUser] = useState<User | null>(null);
  const [pronto, setPronto] = useState(false);
  const [minha, setMinha] = useState<MinhaParticipacao | null>(null);
  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {})
      .finally(() => setPronto(true));
    return onAuthChange(setUser);
  }, []);
  useEffect(() => {
    if (!user) {
      setMinha(null);
      return;
    }
    let vivo = true;
    getAccessToken()
      .then((t) => minhaParticipacaoAction(t, slug))
      .then((m) => vivo && setMinha(m))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user, slug]);

  const status = e.sorteio.status;
  const aoVivo = status === 'sorteando' || status === 'finalizado';
  const participantes = useNumeroAnimado(e.participantes);
  const palavras = e.sorteio.titulo.trim().split(/\s+/);
  const aceso = status === 'abertas' || status === 'sorteando';

  return (
    <div className="sorteio-ui sorteio-pagina">
      <div className="sorteio-brilho" aria-hidden="true" />
      <header className="sorteio-barra">
        <Link href="/" className="sorteio-logo" aria-label="XAN Switch: voltar pra loja">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="XAN Switch" />
        </Link>
        <span className={`sorteio-pilula${aceso ? ' is-vivo' : ''}`}>
          {aceso && <i className="sorteio-ponto" />}
          {NOME_STATUS[status]}
        </span>
      </header>

      {(previa || e.sorteio.teste) && (
        <p className="sorteio-faixa">
          {previa
            ? 'Prévia do admin: o público ainda não vê esta página. Ela abre quando você abrir as inscrições (ou ligar o modo de teste).'
            : 'Modo de teste: este sorteio é um ensaio.'}
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
              <span>{e.participantes === 1 ? 'participante confirmado' : 'participantes confirmados'}</span>
            </div>
            {e.sorteio.data && (
              <div className="sorteio-contador is-data">
                <strong aria-hidden="true">📅</strong>
                <span>{dataDaLive(e.sorteio.data)}</span>
              </div>
            )}
          </div>
          {falhou && <p className="sorteio-faixa is-erro">Sem conexão. Tentando de novo…</p>}
        </section>

        {aoVivo ? (
          <>
            <PainelAoVivo estado={e} diferenca={diferenca} meuCodigo={minha?.codigo ?? null} />
            {minha?.participando && <p className="sorteio-selo-ok">✔ Você está participando</p>}
          </>
        ) : (
          <section className="sorteio-cartao sorteio-participar sorteio-entra" style={{ '--i': palavras.length + 3 } as React.CSSProperties}>
            {!pronto ? (
              <p className="sorteio-carregando">Carregando…</p>
            ) : minha?.participando ? (
              <Participando user={user} />
            ) : (
              <>
                <Passos atual={!user ? 1 : 2} />
                {!user ? (
                  <Entrar />
                ) : status === 'abertas' ? (
                  <Confirmar slug={slug} user={user} onConfirmou={(codigo) => setMinha({ logado: true, participando: true, codigo })} />
                ) : (
                  <div className="sorteio-fechado">
                    <span aria-hidden="true">{status === 'encerradas' ? '🔒' : '⏳'}</span>
                    <p>
                      {status === 'encerradas'
                        ? 'As inscrições foram encerradas. Acompanhe o sorteio por aqui!'
                        : 'As inscrições ainda não abriram. Volte daqui a pouco!'}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <section className="sorteio-secao">
          <h2 className="sorteio-titulo-secao">
            <span className="sorteio-rotulo">O que está em jogo</span>
            Prêmios
          </h2>
          <ListaPremios estado={e} />
        </section>

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

function Passos({ atual }: { atual: number }) {
  const nomes = ['Entrar na conta', 'Seu Instagram', 'Confirmar'];
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

function Participando({ user }: { user: User | null }) {
  return (
    <div className="sorteio-confirmado" role="status">
      <Confete />
      <span className="sorteio-confirmado-icone" aria-hidden="true">
        ✔
      </span>
      <h2>Você está participando!</h2>
      <p>Na hora do sorteio, esta página vira a roleta ao vivo. Deixa ela aberta durante a live pra ver se o seu nome aparece.</p>
      {user?.email && <p className="sorteio-conta">Conta: {user.email}</p>}
    </div>
  );
}

function Confirmar({ slug, user, onConfirmou }: { slug: string; user: User; onConfirmou: (codigo: string) => void }) {
  const [instagram, setInstagram] = useState('');
  const [salvo, setSalvo] = useState<string | null>(null);
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quem já salvou o @ na conta da loja não precisa digitar de novo.
  useEffect(() => {
    getInstagramHandle()
      .then((h) => {
        if (h) {
          setSalvo(h);
          setInstagram((atual) => atual || h);
        }
      })
      .catch(() => {});
  }, []);

  const normalizado = normalizarInstagram(instagram);
  const mostrarErroInsta = instagram.trim() !== '' && !normalizado;

  async function confirmar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!normalizado) {
      setErro('Coloque um @ do Instagram válido (só letras, números, ponto e _).');
      return;
    }
    setEnviando(true);
    setErro(null);
    const token = await getAccessToken().catch(() => null);
    const r = await confirmarPresencaAction(token, slug, aceito, lerDispositivo(), normalizado).catch(() => ({
      ok: false as const,
      erro: 'A conexão falhou. Tente de novo.'
    }));
    setEnviando(false);
    if (r.ok) {
      try {
        localStorage.setItem(CHAVE_DISPOSITIVO, r.dispositivo);
      } catch {
        // sem armazenamento: o cookie do aparelho já vale
      }
      // Guarda o @ na conta da loja também (se mudou).
      if (salvo !== normalizado) saveInstagramHandle(normalizado).catch(() => {});
      onConfirmou(r.codigo);
    } else if ('jaParticipa' in r && r.jaParticipa) {
      onConfirmou('');
    } else setErro(r.erro);
  }

  return (
    <form className="sorteio-confirmar" onSubmit={confirmar}>
      <p className="sorteio-conta">
        Entrou como <strong>{user.email}</strong> ·{' '}
        <button type="button" className="sorteio-link" onClick={() => signOut().catch(() => {})}>
          trocar de conta
        </button>
      </p>
      <label className="sorteio-campo">
        <span>@ do seu Instagram</span>
        <span className={`sorteio-campo-insta${mostrarErroInsta ? ' is-erro' : ''}`}>
          <b aria-hidden="true">@</b>
          <input
            value={instagram}
            onChange={(ev) => setInstagram(ev.target.value)}
            placeholder="seu.usuario"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={60}
            required
            aria-invalid={mostrarErroInsta}
          />
        </span>
        <small>{mostrarErroInsta ? 'Só letras, números, ponto e _ (até 30).' : 'É por ele que a gente fala com você se ganhar.'}</small>
      </label>
      <label className="sorteio-aceite">
        <input type="checkbox" checked={aceito} onChange={(ev) => setAceito(ev.target.checked)} />
        <span>
          Confirmo minha participação e aceito o <a href="#regulamento">regulamento</a>
        </span>
      </label>
      <button type="submit" className="sorteio-botao" disabled={!aceito || !normalizado || enviando}>
        {enviando ? 'Confirmando…' : 'Confirmar presença'}
      </button>
      {erro && (
        <p className="sorteio-erro" role="alert">
          {erro}
        </p>
      )}
    </form>
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
