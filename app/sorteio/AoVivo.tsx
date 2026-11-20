'use client';

// Peças do sorteio ao vivo usadas na página do participante e no telão do
// admin: o estado que se atualiza sozinho, a roleta em carrossel
// sincronizada e a lista de ganhadores. Tudo vem do servidor (o ganhador já
// está decidido); aqui só se mostra. Visual: classes "sorteio-*" em
// sorteio.css (tokens em .sorteio-ui).
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

// "Maria S." → "MS"; "jo***" → "JO".
export function iniciais(nome: string) {
  const partes = nome.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)).toUpperCase();
}

// Um tom de roxo/lilás fixo por nome (o mesmo nome sempre com a mesma cor).
function tom(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 250 + (h % 70); // 250..320: do azul-violeta ao magenta
}

// Confete: posições fixas por índice (sem Math.random, igual em toda tela).
const CONFETE = Array.from({ length: 26 }, (_, i) => ({
  x: Math.round(Math.cos((i / 26) * Math.PI * 2) * (90 + (i % 5) * 34)),
  y: Math.round(Math.sin((i / 26) * Math.PI * 2) * (60 + (i % 4) * 26)) - 30,
  r: (i * 47) % 360,
  d: (i % 6) * 30
}));

export function Confete() {
  return (
    <span className="sorteio-confete" aria-hidden="true">
      {CONFETE.map((c, i) => (
        <i
          key={i}
          style={{ '--x': `${c.x}px`, '--y': `${c.y}px`, '--r': `${c.r}deg`, '--d': `${c.d}ms` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

// Roleta em carrossel: os nomes passam da direita pra esquerda e o card do
// meio para no ganhador, no mesmo instante em todas as telas.
export function Roleta({ sorteio, agora }: { sorteio: SorteioPublico; agora: number }) {
  const total = sorteio.roleta.length;
  const p = progressoRoleta(agora, sorteio.inicio, sorteio.duracao);
  const parou = agora >= sorteio.inicio + sorteio.duracao;
  const pos = p * (total - 1);
  // Velocidade (cards por quadro) → desfoque de movimento.
  const vel = (progressoRoleta(agora + 16, sorteio.inicio, sorteio.duracao) - p) * (total - 1);
  const borrao = parou ? 0 : Math.min(vel * 2.4, 3.2);

  return (
    <div className={`sorteio-carrossel${parou ? ' is-parou' : ''}`}>
      <div className="sorteio-carrossel-janela" aria-hidden="true">
        <span className="sorteio-carrossel-mira" />
        <ol className="sorteio-carrossel-trilho" style={{ '--pos': pos, filter: borrao > 0.15 ? `blur(${borrao.toFixed(2)}px)` : undefined } as React.CSSProperties}>
          {sorteio.roleta.map((nome, i) => {
            const d = Math.min(Math.abs(i - pos), 3);
            const ganhador = parou && i === total - 1;
            // Só desenha o que está perto da janela.
            if (Math.abs(i - pos) > 6) return <li key={i} className="sorteio-carta is-longe" />;
            return (
              <li
                key={i}
                className={`sorteio-carta${ganhador ? ' is-ganhador' : ''}`}
                style={{ '--d': d, '--tom': tom(nome) } as React.CSSProperties}
              >
                <span className="sorteio-carta-avatar">{iniciais(nome)}</span>
                <span className="sorteio-carta-nome">{nome}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {parou && (
        <div className="sorteio-resultado" aria-live="polite">
          <Confete />
          <span className="sorteio-pilula is-ouro">🏆 Ganhador</span>
          <p className="sorteio-resultado-nome">
            {sorteio.ganhador.nome.split(' ').map((palavra, i) => (
              <span key={i} className="sorteio-palavra" style={{ '--i': i } as React.CSSProperties}>
                {palavra}{' '}
              </span>
            ))}
          </p>
          <p className="sorteio-resultado-email">{sorteio.ganhador.email}</p>
        </div>
      )}
    </div>
  );
}

// Área ao vivo: o sorteio da vez (contagem, roleta ou espera) e os ganhadores.
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
  const meusPremios = meuCodigo ? terminados.filter((s) => s.ganhador.codigo === meuCodigo) : [];
  const totalVagas = estado.premios.reduce((n, p) => n + p.ganhadores, 0);
  const premioAtual = atual ? premioDe(atual.premioId) : undefined;
  const contagem = atual && agora < atual.inicio ? Math.max(1, Math.ceil((atual.inicio - agora) / 1000)) : null;

  return (
    <section className="sorteio-ao-vivo">
      {meusPremios.length > 0 && (
        <div className="sorteio-voce-ganhou" role="status">
          <Confete />
          <span className="sorteio-rotulo">Parabéns</span>
          <h2>
            Você <em>ganhou!</em> 🎉
          </h2>
          <p className="sorteio-voce-ganhou-premio">{meusPremios.map((s) => premioDe(s.premioId)?.nome ?? 'Prêmio').join(' + ')}</p>
          {estado.sorteio.mensagemGanhador && <p className="sorteio-voce-ganhou-msg">{estado.sorteio.mensagemGanhador}</p>}
        </div>
      )}

      <div className={`sorteio-palco${atual ? ' is-ativo' : ''}`}>
        <div className="sorteio-palco-topo">
          <span className="sorteio-pilula is-vivo">
            <i className="sorteio-ponto" /> Ao vivo
          </span>
          <span className="sorteio-palco-placar">
            {terminados.length} de {totalVagas} sorteados
          </span>
        </div>
        {atual ? (
          <>
            <div className="sorteio-palco-premio" key={atual.id}>
              {premioAtual?.imagem && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={premioAtual.imagem} alt="" />
              )}
              <div>
                <span className="sorteio-rotulo">{contagem !== null ? 'Vai começar' : 'Sorteando agora'}</span>
                <strong>
                  {premioAtual?.nome ?? 'Prêmio'}
                  {atual.refeito ? <em className="sorteio-palco-refeito"> · novo sorteio</em> : null}
                </strong>
              </div>
            </div>
            {contagem !== null ? (
              <div className="sorteio-contagem" aria-live="polite">
                <span key={contagem} className="sorteio-contagem-num">
                  {contagem}
                </span>
              </div>
            ) : (
              <Roleta sorteio={atual} agora={agora} />
            )}
          </>
        ) : (
          <div className="sorteio-palco-espera">
            <span className="sorteio-palco-espera-icone" aria-hidden="true">
              {estado.sorteio.status === 'finalizado' ? '🏁' : '🎁'}
            </span>
            <p>
              {estado.sorteio.status === 'finalizado'
                ? 'Sorteio finalizado. Obrigado por participar!'
                : estado.sorteio.status === 'sorteando'
                  ? 'Aguardando o próximo sorteio'
                  : 'O sorteio ainda não começou'}
              {estado.sorteio.status !== 'finalizado' && <span className="sorteio-reticencias" aria-hidden="true" />}
            </p>
          </div>
        )}
      </div>

      <div className="sorteio-secao">
        <h2 className="sorteio-titulo-secao">
          <span className="sorteio-rotulo">Quem já levou</span>
          Ganhadores
        </h2>
        {terminados.length === 0 ? (
          <p className="sorteio-vazio">Ninguém sorteado ainda. Fica de olho!</p>
        ) : (
          <ol className="sorteio-ganhadores">
            {terminados.map((s, i) => {
              const premio = premioDe(s.premioId);
              return (
                <li key={s.id} className={s.ganhador.codigo === meuCodigo ? 'is-meu' : undefined} style={{ '--i': i } as React.CSSProperties}>
                  <span className="sorteio-carta-avatar" style={{ '--tom': tom(s.ganhador.nome) } as React.CSSProperties}>
                    {iniciais(s.ganhador.nome)}
                  </span>
                  <span className="sorteio-ganhador-info">
                    <strong>
                      {s.ganhador.nome}
                      {s.ganhador.codigo === meuCodigo && <em className="sorteio-pilula is-ouro">Você</em>}
                    </strong>
                    <span className="sorteio-ganhador-email">{s.ganhador.email}</span>
                  </span>
                  <span className="sorteio-ganhador-premio">
                    {premio?.imagem && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={premio.imagem} alt="" />
                    )}
                    {premio?.nome ?? 'Prêmio'}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

export function ListaPremios({ estado }: { estado: EstadoPublico }) {
  if (!estado.premios.length) return <p className="sorteio-vazio">Os prêmios serão anunciados em breve.</p>;
  return (
    <ul className="sorteio-premios">
      {estado.premios.map((p, i) => (
        <li key={p.id} className="sorteio-premio" style={{ '--i': i } as React.CSSProperties}>
          <div className={`sorteio-premio-foto${p.imagem ? '' : ' is-vazia'}`}>
            {p.imagem ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagem} alt="" loading="lazy" />
            ) : (
              <span aria-hidden="true">🎁</span>
            )}
            <span className="sorteio-pilula">{p.ganhadores === 1 ? '1 ganhador' : `${p.ganhadores} ganhadores`}</span>
          </div>
          <div className="sorteio-premio-texto">
            <strong>{p.nome}</strong>
            {p.descricao && <p>{p.descricao}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
