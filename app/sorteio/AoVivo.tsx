'use client';

// Peças do sorteio ao vivo usadas na página do participante e no telão do
// admin: o estado que se atualiza sozinho, a roleta sincronizada e a lista
// de ganhadores. Tudo vem do servidor (o ganhador já está decidido); aqui
// só se mostra. Visual: classes "sorteio-*" em sorteio.css.
import { useEffect, useRef, useState } from 'react';
import { progressoRoleta } from '@/lib/sorteio/regras';
import type { EstadoPublico, SorteioPublico } from '@/lib/sorteio/estado';

// Depois que a roleta para, o ganhador fica em destaque por um tempo.
const DESTAQUE_MS = 9000;

// Pergunta o estado a cada `intervalo` ms. `diferenca` = relógio do servidor
// menos o do aparelho (pra animação andar igual em todo lugar).
export function useEstadoSorteio(buscar: () => Promise<EstadoPublico | null>, inicial: EstadoPublico | null, intervalo = 2000) {
  const [estado, setEstado] = useState<EstadoPublico | null>(inicial);
  const [diferenca, setDiferenca] = useState(inicial ? inicial.agora - Date.now() : 0);
  const [falhou, setFalhou] = useState(false);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;
  useEffect(() => {
    let vivo = true;
    let timer = 0;
    const rodar = async () => {
      try {
        const e = await buscarRef.current();
        if (!vivo) return;
        if (e) {
          setEstado(e);
          setDiferenca(e.agora - Date.now());
          setFalhou(false);
        }
      } catch {
        if (vivo) setFalhou(true);
      }
      if (vivo) timer = window.setTimeout(rodar, document.hidden ? intervalo * 3 : intervalo);
    };
    rodar();
    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
  }, [intervalo]);
  return { estado, diferenca, falhou };
}

// Busca o estado público pelo link do sorteio.
export function buscarEstadoPublico(slug: string) {
  return async (): Promise<EstadoPublico | null> => {
    const r = await fetch(`/api/sorteios/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as EstadoPublico;
  };
}

// Relógio do servidor, atualizado a cada quadro enquanto `ligado`.
function useAgora(diferenca: number, ligado: boolean) {
  const [agora, setAgora] = useState(() => Date.now() + diferenca);
  useEffect(() => {
    if (!ligado) {
      setAgora(Date.now() + diferenca);
      return;
    }
    let raf = 0;
    const quadro = () => {
      setAgora(Date.now() + diferenca);
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [diferenca, ligado]);
  return agora;
}

// O sorteio mais recente, se ainda estiver rodando ou em destaque.
export function sorteioAtual(estado: EstadoPublico, agora: number): SorteioPublico | null {
  const ultimo = estado.sorteios[estado.sorteios.length - 1];
  return ultimo && agora < ultimo.inicio + ultimo.duracao + DESTAQUE_MS ? ultimo : null;
}

// Roleta de nomes que para no ganhador, no mesmo instante em todas as telas.
export function Roleta({ sorteio, agora }: { sorteio: SorteioPublico; agora: number }) {
  const p = progressoRoleta(agora, sorteio.inicio, sorteio.duracao);
  const parou = agora >= sorteio.inicio + sorteio.duracao;
  const posicao = p * (sorteio.roleta.length - 1);
  return (
    <div className={`sorteio-roleta${parou ? ' is-parou' : ''}`} aria-live="polite">
      <div className="sorteio-roleta-janela">
        <ol className="sorteio-roleta-lista" style={{ '--pos': posicao } as React.CSSProperties} aria-hidden="true">
          {sorteio.roleta.map((nome, i) => (
            <li key={i} className={i === sorteio.roleta.length - 1 && parou ? 'is-ganhador' : undefined}>
              {nome}
            </li>
          ))}
        </ol>
      </div>
      {parou && (
        <p className="sorteio-roleta-resultado">
          <strong>{sorteio.ganhador.nome}</strong> <span>{sorteio.ganhador.email}</span>
        </p>
      )}
    </div>
  );
}

// Área ao vivo: o sorteio da vez (ou "aguardando") e os ganhadores.
export function PainelAoVivo({ estado, diferenca, meuCodigo = null }: { estado: EstadoPublico; diferenca: number; meuCodigo?: string | null }) {
  const [, setTique] = useState(0);
  // Liga o relógio por quadro só perto de um sorteio (antes, durante e no destaque).
  const agoraGrosso = Date.now() + diferenca;
  const atual = sorteioAtual(estado, agoraGrosso);
  const agora = useAgora(diferenca, atual !== null);
  useEffect(() => {
    const t = window.setInterval(() => setTique((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const premioDe = (id: number) => estado.premios.find((p) => p.id === id);
  const terminados = estado.sorteios.filter((s) => agora >= s.inicio + s.duracao);
  const euGanhei = meuCodigo !== null && terminados.some((s) => s.ganhador.codigo === meuCodigo);

  return (
    <section className="sorteio-ao-vivo">
      {euGanhei && (
        <div className="sorteio-voce-ganhou" role="status">
          <h2>Você ganhou! 🎉</h2>
          {estado.sorteio.mensagemGanhador && <p>{estado.sorteio.mensagemGanhador}</p>}
        </div>
      )}

      <div className="sorteio-palco">
        {atual ? (
          <>
            <p className="sorteio-palco-premio">
              {agora < atual.inicio ? 'Vai começar: ' : 'Sorteando: '}
              <strong>{premioDe(atual.premioId)?.nome ?? 'Prêmio'}</strong>
              {atual.refeito ? ' (novo sorteio)' : ''}
            </p>
            {agora < atual.inicio ? (
              <p className="sorteio-palco-contagem">{Math.ceil((atual.inicio - agora) / 1000)}</p>
            ) : (
              <Roleta sorteio={atual} agora={agora} />
            )}
          </>
        ) : (
          <p className="sorteio-palco-espera">
            {estado.sorteio.status === 'finalizado'
              ? 'Sorteio finalizado. Obrigado por participar!'
              : estado.sorteio.status === 'sorteando'
                ? 'Aguardando o próximo sorteio…'
                : 'O sorteio ainda não começou.'}
          </p>
        )}
      </div>

      <h2 className="sorteio-titulo-secao">Ganhadores</h2>
      {terminados.length === 0 ? (
        <p className="sorteio-vazio">Ninguém sorteado ainda.</p>
      ) : (
        <ol className="sorteio-ganhadores">
          {terminados.map((s) => (
            <li key={s.id} className={s.ganhador.codigo === meuCodigo ? 'is-meu' : undefined}>
              <span className="sorteio-ganhador-premio">{premioDe(s.premioId)?.nome ?? 'Prêmio'}</span>
              <strong>{s.ganhador.nome}</strong>
              <span className="sorteio-ganhador-email">{s.ganhador.email}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ListaPremios({ estado }: { estado: EstadoPublico }) {
  if (!estado.premios.length) return null;
  return (
    <ul className="sorteio-premios">
      {estado.premios.map((p) => (
        <li key={p.id} className="sorteio-premio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.imagem && <img src={p.imagem} alt="" loading="lazy" />}
          <div>
            <strong>{p.nome}</strong>
            {p.descricao && <p>{p.descricao}</p>}
            <span className="sorteio-premio-qtd">{p.ganhadores === 1 ? '1 ganhador' : `${p.ganhadores} ganhadores`}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
