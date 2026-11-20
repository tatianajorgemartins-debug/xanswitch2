'use client';

// Painel de um sorteio ao vivo. Três abas:
//  - Configurar: textos, link, regras antifraude e prêmios;
//  - Controle (privada): situação, modo de teste, sortear/re-sortear,
//    histórico e participantes (com suspeitos, desclassificar e CSV);
//  - Telão (vai na live): só nomes e e-mails mascarados, tela cheia e
//    Espaço = sortear o próximo.
// Estrutura simples, com classes "sorteios-adm-*" pra receber o visual depois.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { NOME_STATUS, proximoStatus, proximaVaga } from '@/lib/sorteio/regras';
import { ListaPremios, PainelAoVivo, useEstadoSorteio } from '@/app/sorteio/AoVivo';
import {
  apagarPremioAction,
  apagarSorteioAction,
  avancarStatusAction,
  dadosControleAction,
  desclassificarAction,
  estadoTelaoAction,
  gerarTesteAction,
  modoTesteAction,
  refazerSorteioAction,
  resetarAction,
  salvarPremioAction,
  salvarSorteioAction,
  sortearAction,
  type DadosControle
} from '../actions';

type Aba = 'configurar' | 'controle' | 'telao';
type Aviso = { tipo: 'ok' | 'erro'; texto: string } | null;
type Resposta = { ok: true } | { ok: false; erro: string };

// ISO → "2026-12-11T21:00" no horário de Brasília (campo datetime-local).
function paraCampo(iso: string | null): string {
  return iso ? new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 16) : '';
}
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default function SorteioAdmin({ inicial }: { inicial: DadosControle }) {
  const id = inicial.sorteio.id;
  const [dados, setDados] = useState(inicial);
  const [aba, setAba] = useState<Aba>(inicial.sorteio.status === 'rascunho' && !inicial.sorteio.teste ? 'configurar' : 'controle');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const d = await dadosControleAction(id).catch(() => null);
    if (d) setDados(d);
  }, [id]);

  // Controle: participantes e sorteios atualizam sozinhos.
  useEffect(() => {
    if (aba !== 'controle') return;
    const t = window.setInterval(recarregar, 4000);
    return () => window.clearInterval(t);
  }, [aba, recarregar]);

  // Roda uma ação, mostra o resultado e recarrega.
  const executar = useCallback(
    async (acao: () => Promise<Resposta>, sucesso?: string) => {
      setOcupado(true);
      const r = await acao().catch(() => ({ ok: false as const, erro: 'A conexão falhou. Tente de novo.' }));
      setOcupado(false);
      setAviso(r.ok ? (sucesso ? { tipo: 'ok', texto: sucesso } : null) : { tipo: 'erro', texto: r.erro });
      await recarregar();
      return r.ok;
    },
    [recarregar]
  );

  const s = dados.sorteio;
  return (
    <div className="sorteios-adm">
      <header className="sorteios-adm-topo">
        <Link href="/admin" className="btn ghost">
          ← Admin
        </Link>
        <h1>{s.titulo}</h1>
        <span className="sorteios-adm-status">{NOME_STATUS[s.status]}</span>
        {s.teste && <span className="sorteios-adm-teste">Modo de teste</span>}
        <a className="btn ghost" href={`/sorteio/${s.slug}`} target="_blank" rel="noreferrer">
          Abrir página pública ↗
        </a>
      </header>

      <nav className="sorteios-adm-abas" role="tablist">
        {(
          [
            ['configurar', 'Configurar'],
            ['controle', 'Controle'],
            ['telao', 'Telão']
          ] as [Aba, string][]
        ).map(([a, nome]) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} className={aba === a ? 'is-on' : ''} onClick={() => setAba(a)}>
            {nome}
          </button>
        ))}
      </nav>

      {aviso && (
        <p className={`sorteios-adm-aviso is-${aviso.tipo}`} role="status">
          {aviso.texto}
        </p>
      )}

      {aba === 'configurar' && <Configurar dados={dados} executar={executar} ocupado={ocupado} />}
      {aba === 'controle' && <Controle dados={dados} executar={executar} ocupado={ocupado} />}
      {aba === 'telao' && <Telao id={id} premiosAdmin={dados} />}
    </div>
  );
}

type PropsAba = {
  dados: DadosControle;
  executar: (acao: () => Promise<Resposta>, sucesso?: string) => Promise<boolean>;
  ocupado: boolean;
};

// ---------- Configurar ----------

function Configurar({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  return (
    <div className="sorteios-adm-config">
      <form
        className="adm-card sorteios-adm-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          executar(() => salvarSorteioAction(s.id, form), 'Sorteio salvo.');
        }}
      >
        <h3>Sorteio</h3>
        <label>
          Título
          <input name="titulo" defaultValue={s.titulo} maxLength={120} required />
        </label>
        <label>
          Link (/sorteio/…)
          <input name="slug" defaultValue={s.slug} maxLength={60} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </label>
        <label>
          Descrição
          <textarea name="descricao" defaultValue={s.descricao} rows={3} maxLength={2000} />
        </label>
        <label>
          Regulamento
          <textarea name="regulamento" defaultValue={s.regulamento} rows={8} maxLength={20000} />
        </label>
        <label>
          Data da live (horário de Brasília)
          <input type="datetime-local" name="data" defaultValue={paraCampo(s.data)} />
        </label>
        <label>
          Banner (opcional)
          <input type="file" name="banner" accept="image/*" />
        </label>
        {s.banner && (
          <label className="sorteios-adm-check">
            <input type="checkbox" name="removerBanner" value="1" /> Remover o banner atual
          </label>
        )}
        <label>
          Mensagem pro ganhador (aparece na página dele)
          <textarea name="mensagemGanhador" defaultValue={s.mensagemGanhador} rows={3} maxLength={2000} placeholder="ex: Chama a gente no WhatsApp em até 48 h pra receber o prêmio." />
        </label>

        <h3>Antifraude</h3>
        <label>
          Participações por IP (vazio = sem limite)
          <input type="number" name="limitePorIp" min={1} max={1000} defaultValue={s.limitePorIp ?? ''} />
        </label>
        <label className="sorteios-adm-check">
          <input type="checkbox" name="bloquearDispositivo" value="1" defaultChecked={s.bloquearDispositivo} /> Bloquear o mesmo aparelho em contas diferentes
        </label>
        <label>
          Só contas criadas antes de (horário de Brasília, vazio = qualquer conta)
          <input type="datetime-local" name="contasCriadasAntes" defaultValue={paraCampo(s.contasCriadasAntes)} />
        </label>
        <p className="adm-help">
          A loja não tem confirmação de e-mail nem CPF, então essas duas opções não existem. A data acima é o que impede criar conta
          nova durante a live.
        </p>
        <button type="submit" className="btn primary" disabled={ocupado}>
          Salvar
        </button>
      </form>

      <Premios dados={dados} executar={executar} ocupado={ocupado} />

      {(s.status === 'rascunho' || s.teste) && (
        <button
          type="button"
          className="btn ghost adm-danger"
          disabled={ocupado}
          onClick={async () => {
            if (!window.confirm(`Apagar o sorteio "${s.titulo}" de vez?`)) return;
            if (await executar(() => apagarSorteioAction(s.id))) window.location.href = '/admin';
          }}
        >
          Apagar sorteio
        </button>
      )}
    </div>
  );
}

function Premios({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  const [editando, setEditando] = useState<number | 'novo' | null>(null);
  const premio = typeof editando === 'number' ? dados.premios.find((p) => p.id === editando) : null;
  return (
    <section className="adm-card sorteios-adm-premios">
      <h3>Prêmios</h3>
      {dados.premios.length === 0 ? (
        <p className="adm-empty">Nenhum prêmio ainda.</p>
      ) : (
        <ol className="sorteios-adm-lista-premios">
          {dados.premios.map((p) => (
            <li key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.imagem && <img src={p.imagem} alt="" />}
              <span>
                <strong>{p.nome}</strong> · {p.ganhadores} {p.ganhadores === 1 ? 'ganhador' : 'ganhadores'} · ordem {p.ordem}
              </span>
              <button type="button" className="btn ghost" onClick={() => setEditando(p.id)}>
                Editar
              </button>
              <button
                type="button"
                className="btn ghost adm-danger"
                disabled={ocupado}
                onClick={() => window.confirm(`Apagar o prêmio "${p.nome}"?`) && executar(() => apagarPremioAction(s.id, p.id), 'Prêmio apagado.')}
              >
                Apagar
              </button>
            </li>
          ))}
        </ol>
      )}
      {editando === null ? (
        <button type="button" className="btn ghost" onClick={() => setEditando('novo')}>
          ＋ Adicionar prêmio
        </button>
      ) : (
        <form
          key={String(editando)}
          className="sorteios-adm-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            if (await executar(() => salvarPremioAction(s.id, premio?.id ?? null, form), 'Prêmio salvo.')) setEditando(null);
          }}
        >
          <label>
            Nome
            <input name="nome" defaultValue={premio?.nome} maxLength={120} required />
          </label>
          <label>
            Descrição
            <textarea name="descricao" defaultValue={premio?.descricao} rows={2} maxLength={1000} />
          </label>
          <label>
            Imagem (opcional)
            <input type="file" name="imagem" accept="image/*" />
          </label>
          {premio?.imagem && (
            <label className="sorteios-adm-check">
              <input type="checkbox" name="removerImagem" value="1" /> Remover a imagem atual
            </label>
          )}
          <label>
            Quantos ganhadores
            <input type="number" name="ganhadores" min={1} max={100} defaultValue={premio?.ganhadores ?? 1} required />
          </label>
          <label>
            Ordem do sorteio (menor sai primeiro)
            <input type="number" name="ordem" defaultValue={premio?.ordem ?? dados.premios.length + 1} />
          </label>
          <div className="sorteios-adm-linha">
            <button type="submit" className="btn primary" disabled={ocupado}>
              Salvar prêmio
            </button>
            <button type="button" className="btn ghost" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ---------- Controle (privado) ----------

function Controle({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  const proximo = proximoStatus(s.status);
  const [premioEscolhido, setPremioEscolhido] = useState<string>('');
  const [quantosTeste, setQuantosTeste] = useState(50);
  const premioDe = (pid: number) => dados.premios.find((p) => p.id === pid)?.nome ?? 'Prêmio';
  const sorteiosParaRegras = dados.sorteios.map((x) => ({ id: x.id, premioId: x.premioId, entradaId: x.entradaId, vaga: x.vaga, anulado: x.anulado }));
  const vagaLivre = proximaVaga(dados.premios, sorteiosParaRegras);
  const testes = dados.participacoes.filter((p) => p.teste).length;

  return (
    <div className="sorteios-adm-controle">
      <section className="adm-card">
        <h3>Situação: {NOME_STATUS[s.status]}</h3>
        {proximo ? (
          <button
            type="button"
            className="btn primary"
            disabled={ocupado}
            onClick={() =>
              window.confirm(`Mudar pra "${NOME_STATUS[proximo]}"? Não dá pra voltar (só resetando no modo de teste).`) &&
              executar(() => avancarStatusAction(s.id, s.status), `Agora: ${NOME_STATUS[proximo]}.`)
            }
          >
            Avançar para “{NOME_STATUS[proximo]}”
          </button>
        ) : (
          <p className="adm-help">Sorteio finalizado.</p>
        )}
        <p className="adm-help">Rascunho → Inscrições abertas → Inscrições encerradas → Sorteando → Finalizado.</p>
      </section>

      <section className="adm-card">
        <h3>Modo de teste {s.teste ? '(ligado)' : '(desligado)'}</h3>
        {s.teste ? (
          <>
            <p className="adm-help">
              Ensaio: gere participantes fictícios, avance até “Sorteando” e teste o telão. {testes ? `${testes} fictícios agora.` : ''}
            </p>
            <div className="sorteios-adm-linha">
              <input type="number" min={1} max={500} value={quantosTeste} onChange={(e) => setQuantosTeste(Number(e.target.value))} aria-label="Quantos participantes fictícios" />
              <button type="button" className="btn ghost" disabled={ocupado} onClick={() => executar(() => gerarTesteAction(s.id, quantosTeste), 'Participantes fictícios criados.')}>
                Gerar participantes fictícios
              </button>
              <button
                type="button"
                className="btn ghost adm-danger"
                disabled={ocupado}
                onClick={() => window.confirm('Resetar? Apaga sorteios, participantes e volta pro rascunho.') && executar(() => resetarAction(s.id), 'Sorteio resetado.')}
              >
                Resetar
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={ocupado}
                onClick={() =>
                  window.confirm('Desligar o modo de teste? Apaga tudo do ensaio (participantes e sorteios) e volta pro rascunho.') &&
                  executar(() => modoTesteAction(s.id, false), 'Modo de teste desligado. Pronto pra valer.')
                }
              >
                Desligar e limpar o ensaio
              </button>
            </div>
          </>
        ) : s.status === 'rascunho' ? (
          <button type="button" className="btn ghost" disabled={ocupado} onClick={() => executar(() => modoTesteAction(s.id, true), 'Modo de teste ligado.')}>
            Ligar modo de teste (ensaio)
          </button>
        ) : (
          <p className="adm-help">O modo de teste só liga com o sorteio em rascunho.</p>
        )}
      </section>

      <section className="adm-card">
        <h3>Sortear</h3>
        <div className="sorteios-adm-linha">
          <select value={premioEscolhido} onChange={(e) => setPremioEscolhido(e.target.value)} aria-label="Qual prêmio sortear">
            <option value="">Próximo prêmio da fila{vagaLivre ? ` (${vagaLivre.premio.nome})` : ''}</option>
            {dados.premios.map((p) => (
              <option key={p.id} value={p.id} disabled={!proximaVaga(dados.premios, sorteiosParaRegras, p.id)}>
                {p.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn primary"
            disabled={ocupado || s.status !== 'sorteando'}
            onClick={() => executar(() => sortearAction(s.id, premioEscolhido ? Number(premioEscolhido) : null), 'Sorteado! A animação começa em instantes.')}
          >
            Sortear
          </button>
        </div>
        {s.status !== 'sorteando' && <p className="adm-help">O botão libera quando a situação for “Sorteando”.</p>}

        <h4>Histórico</h4>
        {dados.sorteios.length === 0 ? (
          <p className="adm-empty">Nenhum sorteio feito.</p>
        ) : (
          <table className="adm-jogos-tabela">
            <thead>
              <tr>
                <th>Prêmio</th>
                <th>Ganhador</th>
                <th>Quando</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.sorteios.map((x) => (
                <tr key={x.id} className={x.anulado ? 'is-anulado' : undefined}>
                  <td>
                    {premioDe(x.premioId)} #{x.vaga}
                  </td>
                  <td>
                    <strong>{x.ganhador.nome ?? '—'}</strong>
                    <br />
                    <span className="adm-muted">{x.ganhador.email}</span>
                  </td>
                  <td>
                    {dataHora(x.criadoEm)} · {x.quem}
                  </td>
                  <td>
                    {x.anulado ? `Anulado: ${x.motivoAnulado ?? ''}` : x.refeito ? 'Re-sorteio' : 'Valendo'}
                  </td>
                  <td>
                    {!x.anulado && s.status === 'sorteando' && (
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={ocupado}
                        onClick={() => {
                          const motivo = window.prompt('Motivo do novo sorteio (ex: não respondeu em 48 h):');
                          if (motivo) executar(() => refazerSorteioAction(s.id, x.id, motivo), 'Novo sorteio feito. O anterior ficou no histórico.');
                        }}
                      >
                        Re-sortear
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Participantes dados={dados} executar={executar} ocupado={ocupado} />
    </div>
  );
}

function Participantes({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  const [busca, setBusca] = useState('');
  const [soSuspeitos, setSoSuspeitos] = useState(false);

  // Suspeito: mesmo IP ou mesmo aparelho que outra participação.
  const repetidos = useMemo(() => {
    const ips = new Map<string, number>();
    const aparelhos = new Map<string, number>();
    for (const p of dados.participacoes) {
      if (p.teste) continue;
      if (p.ip) ips.set(p.ip, (ips.get(p.ip) ?? 0) + 1);
      if (p.dispositivo) aparelhos.set(p.dispositivo, (aparelhos.get(p.dispositivo) ?? 0) + 1);
    }
    return { ips, aparelhos };
  }, [dados.participacoes]);
  const motivosSuspeita = (p: DadosControle['participacoes'][number]) => {
    const m: string[] = [];
    const nIp = p.ip ? (repetidos.ips.get(p.ip) ?? 0) : 0;
    const nAp = p.dispositivo ? (repetidos.aparelhos.get(p.dispositivo) ?? 0) : 0;
    if (nIp > 1) m.push(`IP em ${nIp} contas`);
    if (nAp > 1) m.push(`aparelho em ${nAp} contas`);
    return m;
  };

  const q = busca.trim().toLowerCase();
  const lista = dados.participacoes.filter(
    (p) => (!q || `${p.nome ?? ''} ${p.email} ${p.ip ?? ''}`.toLowerCase().includes(q)) && (!soSuspeitos || motivosSuspeita(p).length > 0)
  );
  const validos = dados.participacoes.filter((p) => !p.desclassificado).length;

  function exportarCsv() {
    const campo = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [
      ['nome', 'email', 'data', 'ip', 'navegador', 'aparelho', 'suspeita', 'ficticio', 'desclassificado', 'motivo'].join(';'),
      ...dados.participacoes.map((p) =>
        [p.nome, p.email, dataHora(p.criadoEm), p.ip, p.navegador, p.dispositivo, motivosSuspeita(p).join(', '), p.teste ? 'sim' : 'não', p.desclassificado ? 'sim' : 'não', p.motivo]
          .map(campo)
          .join(';')
      )
    ];
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `participantes-${s.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="adm-card sorteios-adm-participantes">
      <h3>
        Participantes: {validos} {dados.participacoes.length !== validos ? `(+${dados.participacoes.length - validos} desclassificados)` : ''}
      </h3>
      <div className="sorteios-adm-linha">
        <input type="search" placeholder="Buscar nome, e-mail ou IP" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="sorteios-adm-check">
          <input type="checkbox" checked={soSuspeitos} onChange={(e) => setSoSuspeitos(e.target.checked)} /> Só suspeitos
        </label>
        <button type="button" className="btn ghost" onClick={exportarCsv} disabled={!dados.participacoes.length}>
          Exportar CSV
        </button>
      </div>
      <div className="sorteios-adm-tabela">
        <table className="adm-jogos-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Quando</th>
              <th>IP</th>
              <th>Alerta</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.slice(0, 500).map((p) => {
              const alerta = motivosSuspeita(p);
              return (
                <tr key={p.id} className={`${p.desclassificado ? 'is-desclassificado' : ''}${alerta.length ? ' is-suspeito' : ''}`}>
                  <td>
                    {p.nome ?? '—'}
                    {p.teste && <span className="adm-muted"> (fictício)</span>}
                  </td>
                  <td>{p.email}</td>
                  <td>{dataHora(p.criadoEm)}</td>
                  <td>{p.ip ?? '—'}</td>
                  <td>{[...alerta, p.desclassificado ? `desclassificado${p.motivo ? `: ${p.motivo}` : ''}` : ''].filter(Boolean).join(' · ') || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={ocupado}
                      onClick={() => {
                        if (p.desclassificado) executar(() => desclassificarAction(s.id, p.id, false, ''), 'Participação reativada.');
                        else {
                          const motivo = window.prompt(`Desclassificar ${p.nome ?? p.email}? Motivo:`);
                          if (motivo !== null) executar(() => desclassificarAction(s.id, p.id, true, motivo), 'Participação desclassificada.');
                        }
                      }}
                    >
                      {p.desclassificado ? 'Reativar' : 'Desclassificar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length > 500 && <p className="adm-help">Mostrando 500 de {lista.length}. Use a busca ou o CSV.</p>}
      </div>
    </section>
  );
}

// ---------- Telão (vai na live) ----------

function Telao({ id, premiosAdmin }: { id: number; premiosAdmin: DadosControle }) {
  const caixa = useRef<HTMLDivElement>(null);
  const buscar = useCallback(() => estadoTelaoAction(id), [id]);
  const { estado, diferenca } = useEstadoSorteio(buscar, null, 1500);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [sorteando, setSorteando] = useState(false);

  const sortearProximo = useCallback(async () => {
    if (sorteando) return;
    setSorteando(true);
    const r = await sortearAction(id, null).catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    setSorteando(false);
    setMensagem(r.ok ? null : r.erro);
  }, [id, sorteando]);

  // Espaço = sortear o próximo prêmio (fora de campos de texto).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.code !== 'Space' || e.repeat || (alvo && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(alvo.tagName))) return;
      e.preventDefault();
      sortearProximo();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [sortearProximo]);

  if (!estado) return <p className="adm-help">Carregando o telão…</p>;
  return (
    <div ref={caixa} className="sorteio-telao">
      <div className="sorteio-telao-controles">
        <button type="button" className="sorteio-telao-botao" onClick={() => caixa.current?.requestFullscreen?.().catch(() => {})}>
          Tela cheia
        </button>
        <button type="button" className="sorteio-telao-botao" onClick={sortearProximo} disabled={sorteando || estado.sorteio.status !== 'sorteando'}>
          Sortear próximo (Espaço)
        </button>
        {mensagem && <span className="sorteio-telao-msg">{mensagem}</span>}
      </div>
      <h1 className="sorteio-titulo">{estado.sorteio.titulo}</h1>
      <p className="sorteio-contador">
        <strong>{estado.participantes.toLocaleString('pt-BR')}</strong> participantes
      </p>
      <PainelAoVivo estado={estado} diferenca={diferenca} />
      <h2 className="sorteio-titulo-secao">Prêmios</h2>
      <ListaPremios estado={estado} />
      <p className="sorteio-telao-rodape">{premiosAdmin.premios.length} prêmios · xanswitch.com.br/sorteio/{estado.sorteio.slug}</p>
    </div>
  );
}
