'use client';

// Página do participante (/sorteio/<slug>): entra com a conta da loja,
// confirma presença e, quando o sorteio começa, acompanha a roleta e os
// ganhadores ao vivo (só assistindo). O visual fica em ../sorteio.css.
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getAccessToken, getCurrentUser, onAuthChange, signIn, signInWithGoogle, signUp, translateAuthError } from '@/lib/wishlist';
import { NOME_STATUS } from '@/lib/sorteio/regras';
import type { EstadoPublico } from '@/lib/sorteio/estado';
import { confirmarPresencaAction, minhaParticipacaoAction, type MinhaParticipacao } from '../actions';
import { ListaPremios, PainelAoVivo, buscarEstadoPublico, useEstadoSorteio } from '../AoVivo';

const CHAVE_DISPOSITIVO = 'xan_sorteio_dispositivo';

function lerDispositivo(): string | null {
  try {
    return localStorage.getItem(CHAVE_DISPOSITIVO);
  } catch {
    return null;
  }
}

export default function SorteioClient({ inicial }: { inicial: EstadoPublico }) {
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

  return (
    <main className="sorteio-pagina">
      {e.sorteio.teste && <p className="sorteio-aviso-teste">Modo de teste: este sorteio é um ensaio.</p>}
      <header className="sorteio-cabeca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {e.sorteio.banner && <img className="sorteio-banner" src={e.sorteio.banner} alt="" />}
        <p className="sorteio-status">{NOME_STATUS[status]}</p>
        <h1 className="sorteio-titulo">{e.sorteio.titulo}</h1>
        {e.sorteio.descricao && <p className="sorteio-descricao">{e.sorteio.descricao}</p>}
        <p className="sorteio-contador" aria-live="polite">
          <strong>{e.participantes.toLocaleString('pt-BR')}</strong> {e.participantes === 1 ? 'participante' : 'participantes'}
        </p>
        {falhou && <p className="sorteio-aviso">Sem conexão. Tentando de novo…</p>}
      </header>

      {aoVivo ? (
        <>
          <PainelAoVivo estado={e} diferenca={diferenca} meuCodigo={minha?.codigo ?? null} />
          {minha?.participando && <p className="sorteio-participando">Você está participando ✔</p>}
        </>
      ) : (
        <section className="sorteio-participar">
          {!pronto ? null : !user ? (
            <Entrar />
          ) : minha?.participando ? (
            <p className="sorteio-participando">Você está participando ✔</p>
          ) : status === 'abertas' ? (
            <Confirmar slug={slug} onConfirmou={(codigo) => setMinha({ logado: true, participando: true, codigo })} />
          ) : (
            <p className="sorteio-aviso">{status === 'encerradas' ? 'As inscrições foram encerradas.' : 'As inscrições ainda não abriram.'}</p>
          )}
        </section>
      )}

      <section className="sorteio-secao">
        <h2 className="sorteio-titulo-secao">Prêmios</h2>
        <ListaPremios estado={e} />
      </section>

      {e.sorteio.regulamento && (
        <details className="sorteio-regulamento">
          <summary>Regulamento</summary>
          <div className="sorteio-regulamento-texto">{e.sorteio.regulamento}</div>
        </details>
      )}
    </main>
  );
}

function Confirmar({ slug, onConfirmou }: { slug: string; onConfirmou: (codigo: string) => void }) {
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    const token = await getAccessToken().catch(() => null);
    const r = await confirmarPresencaAction(token, slug, aceito, lerDispositivo()).catch(() => ({
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
      onConfirmou(r.codigo);
    } else if ('jaParticipa' in r && r.jaParticipa) {
      onConfirmou('');
    } else setErro(r.erro);
  }

  return (
    <div className="sorteio-confirmar">
      <label className="sorteio-aceite">
        <input type="checkbox" checked={aceito} onChange={(ev) => setAceito(ev.target.checked)} />
        Confirmo minha participação e aceito o regulamento
      </label>
      <button type="button" className="sorteio-botao" disabled={!aceito || enviando} onClick={confirmar}>
        {enviando ? 'Confirmando…' : 'Confirmar presença'}
      </button>
      {erro && (
        <p className="sorteio-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
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
      <p>Entre com a sua conta da XAN Switch pra participar.</p>
      <button type="button" className="sorteio-botao is-google" onClick={() => signInWithGoogle().catch(() => setErro('Não deu pra entrar com o Google.'))}>
        Entrar com o Google
      </button>
      <form onSubmit={enviar} className="sorteio-form">
        <label>
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(ev) => setEmail(ev.target.value)} />
        </label>
        <label>
          Senha
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
