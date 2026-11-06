'use client';

// Controle de vendas (/admin > 📊 Vendas): a "planilha" da loja. Toda venda
// do site entra aqui sozinha; as feitas fora do site você lança no
// "＋ Lançar venda". Filtros, totais, média mensal, ranking de jogos, lucro
// por venda (preço − custo − taxa extra) e exportação pra Excel.
// Regras de status/pagamento/lucro em lib/sales.ts; gravação em
// salesActions.ts.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Game, Order } from '@/lib/db';
import { formatPriceBR } from '@/lib/whatsapp';
import { gamePrice } from '@/lib/gamePrice';
import {
  PAYMENT_METHODS,
  SALE_STATUSES,
  normalizeStatus,
  paymentLabel,
  saleCustomer,
  saleProfit,
  statusLabel,
  toNumber
} from '@/lib/sales';
import {
  createManualSaleAction,
  setSaleCostAction,
  setSalesStatusAction,
  updateSaleAction,
  type SaleInput
} from './salesActions';
import { deleteOrderAction } from './actions';

const TZ = 'America/Sao_Paulo';
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "2026-11-06" no fuso de Brasília.
function dayKey(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
}
function formatDay(d: Date | string): string {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit' });
}
// "18:42" no fuso de Brasília.
function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}
function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
function money(n: number): string {
  return `${n < 0 ? '−' : ''}R$ ${formatPriceBR(Math.abs(n))}`;
}
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

type Period = 'mes' | 'mes-passado' | '30d' | 'ano' | 'tudo' | 'custom';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'mes', label: 'Este mês' },
  { id: 'mes-passado', label: 'Mês passado' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'ano', label: 'Este ano' },
  { id: 'tudo', label: 'Tudo' },
  { id: 'custom', label: 'Escolher datas' }
];

function periodRange(period: Period, from: string, to: string): [string, string] | null {
  const today = dayKey(new Date());
  const month = today.slice(0, 7);
  switch (period) {
    case 'mes':
      return [`${month}-01`, today];
    case 'mes-passado': {
      const prev = shiftMonth(month, -1);
      return [`${prev}-01`, `${prev}-31`];
    }
    case '30d':
      return [dayKey(new Date(Date.now() - 29 * 86400000)), today];
    case 'ano':
      return [`${today.slice(0, 4)}-01-01`, today];
    case 'custom':
      return [from || '0000-01-01', to || '9999-12-31'];
    default:
      return null;
  }
}

type StatusFilter = 'validas' | 'concluido' | 'aguardando_codigo' | 'cancelado' | 'todas';

export default function SalesPanel({ orders, games }: { orders: Order[]; games: Game[] }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('tudo');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [game, setGame] = useState('');
  const [payment, setPayment] = useState('');
  const [status, setStatus] = useState<StatusFilter>('validas');
  const [customer, setCustomer] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [source, setSource] = useState('');
  const [onlyNoCost, setOnlyNoCost] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(40);
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const gameNames = useMemo(
    () => Array.from(new Set(orders.map((o) => o.game_name))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [orders]
  );

  // Último custo informado de cada jogo (a lista vem da mais nova pra mais
  // antiga): sugerido nas vendas novas do mesmo jogo.
  const lastCost = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const c = toNumber(o.cost);
      if (c !== null && !map.has(o.game_name)) map.set(o.game_name, c);
    }
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const range = periodRange(period, from, to);
    const q = customer.trim().toLowerCase();
    const min = toNumber(priceMin.replace(',', '.'));
    const max = toNumber(priceMax.replace(',', '.'));
    return orders.filter((o) => {
      const st = normalizeStatus(o.status);
      if (status === 'validas' ? st === 'cancelado' : status !== 'todas' && st !== status) return false;
      if (range) {
        const k = dayKey(o.created_at);
        if (k < range[0] || k > range[1]) return false;
      }
      if (game && o.game_name !== game) return false;
      if (payment && o.payment_method !== payment) return false;
      if (source && (o.source ?? 'site') !== source) return false;
      const price = toNumber(o.price) ?? 0;
      if (min !== null && price < min) return false;
      if (max !== null && price > max) return false;
      if (onlyNoCost && toNumber(o.cost) !== null) return false;
      if (q) {
        const hay = `${o.customer_name ?? ''} ${o.customer_email ?? ''} ${o.customer_whatsapp ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, period, from, to, game, payment, status, customer, priceMin, priceMax, source, onlyNoCost]);

  const totals = useMemo(() => {
    let revenue = 0;
    let profit = 0;
    let revenueWithCost = 0;
    let withCost = 0;
    for (const o of filtered) {
      const price = toNumber(o.price) ?? 0;
      revenue += price;
      const p = saleProfit(o);
      if (p !== null) {
        profit += p;
        revenueWithCost += price;
        withCost++;
      }
    }
    return {
      count: filtered.length,
      revenue,
      profit,
      withCost,
      noCost: filtered.length - withCost,
      ticket: filtered.length ? revenue / filtered.length : 0,
      margin: revenueWithCost ? (profit / revenueWithCost) * 100 : null
    };
  }, [filtered]);

  // Mês a mês (do mês da venda mais antiga até o da mais nova, incluindo
  // meses sem venda, pra média não ficar inflada).
  const monthly = useMemo(() => {
    if (filtered.length === 0) return { rows: [], avg: null };
    const byMonth = new Map<string, { count: number; revenue: number; profit: number }>();
    for (const o of filtered) {
      const key = dayKey(o.created_at).slice(0, 7);
      const row = byMonth.get(key) ?? { count: 0, revenue: 0, profit: 0 };
      row.count++;
      row.revenue += toNumber(o.price) ?? 0;
      row.profit += saleProfit(o) ?? 0;
      byMonth.set(key, row);
    }
    const keys = Array.from(byMonth.keys()).sort();
    const rows: { key: string; count: number; revenue: number; profit: number }[] = [];
    for (let k = keys[0]; k <= keys[keys.length - 1]; k = shiftMonth(k, 1)) {
      rows.push({ key: k, ...(byMonth.get(k) ?? { count: 0, revenue: 0, profit: 0 }) });
    }
    const n = rows.length;
    return {
      rows: rows.reverse(),
      avg: {
        months: n,
        count: totals.count / n,
        revenue: totals.revenue / n,
        profit: totals.profit / n
      }
    };
  }, [filtered, totals]);

  const topGames = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number; profit: number }>();
    for (const o of filtered) {
      const row = map.get(o.game_name) ?? { name: o.game_name, count: 0, revenue: 0, profit: 0 };
      row.count++;
      row.revenue += toNumber(o.price) ?? 0;
      row.profit += saleProfit(o) ?? 0;
      map.set(o.game_name, row);
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 8);
  }, [filtered]);

  const pendingInView = filtered.filter((o) => normalizeStatus(o.status) === 'aguardando_codigo');
  const activeFilterCount = [game, payment, customer, priceMin, priceMax, source].filter(Boolean).length + (onlyNoCost ? 1 : 0) + (status !== 'validas' ? 1 : 0);

  function clearFilters() {
    setGame('');
    setPayment('');
    setCustomer('');
    setPriceMin('');
    setPriceMax('');
    setSource('');
    setOnlyNoCost(false);
    setStatus('validas');
  }

  async function concludeAllInView() {
    if (!confirm(`Marcar ${pendingInView.length} venda(s) como concluída(s)?`)) return;
    const r = await setSalesStatusAction(pendingInView.map((o) => o.id), 'concluido');
    setBulkMsg(r.ok ? '✓ Vendas marcadas como concluídas.' : r.error);
    if (r.ok) router.refresh();
  }

  function exportCsv() {
    const header = ['Data', 'Hora', 'Jogo', 'Cliente', 'E-mail', 'WhatsApp', 'Pagamento', 'Situação', 'Origem', 'Preço', 'Custo', 'Taxa extra', 'Lucro', 'Observação'];
    const num = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = filtered.map((o) =>
      [
        formatDay(o.created_at),
        formatTime(o.created_at),
        o.game_name,
        o.customer_name ?? '',
        o.customer_email ?? '',
        o.customer_whatsapp ?? '',
        paymentLabel(o.payment_method),
        statusLabel(o.status).replace(/^\S+ /, ''),
        o.source === 'manual' ? 'Lançada à mão' : 'Site',
        num(toNumber(o.price)),
        num(toNumber(o.cost)),
        num(toNumber(o.fee)),
        num(saleProfit(o)),
        o.notes ?? ''
      ]
        .map((v) => esc(String(v)))
        .join(';')
    );
    // BOM + ";" = o Excel em português abre certinho, com acentos.
    const blob = new Blob(['﻿' + [header.map(esc).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vendas-xan-switch-${dayKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const maxRevenue = Math.max(1, ...monthly.rows.map((r) => r.revenue));

  return (
    <section className="adm-sales">
      <div className="adm-section-head">
        <div>
          <h2>📊 Controle de vendas</h2>
          <p className="adm-help">
            Sua planilha de vendas. Toda venda do site entra aqui sozinha. Vendeu fora do site? Use{' '}
            <strong>＋ Lançar venda</strong>. Informe o <strong>custo</strong> de cada venda e o lucro é calculado
            na hora (preço − custo).
          </p>
        </div>
        <div className="adm-head-actions">
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            ＋ Lançar venda
          </button>
          <button type="button" className="btn ghost" onClick={exportCsv} disabled={filtered.length === 0}>
            ⬇ Baixar planilha (Excel)
          </button>
        </div>
      </div>

      {/* Período: o filtro mais usado fica sempre à vista. */}
      <div className="adm-chips" role="group" aria-label="Período">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`adm-chip${period === p.id ? ' is-on' : ''}`}
            onClick={() => {
              setPeriod(p.id);
              setVisible(40);
            }}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className={`adm-chip is-filter${activeFilterCount ? ' is-on' : ''}`} onClick={() => setShowFilters((v) => !v)}>
          ⚙ Mais filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {period === 'custom' && (
        <div className="adm-filter-row">
          <label>
            De
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      )}

      {showFilters && (
        <div className="adm-filters">
          <label>
            Jogo
            <select value={game} onChange={(e) => setGame(e.target.value)}>
              <option value="">Todos os jogos</option>
              {gameNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pagamento
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="">Todos</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Situação
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="validas">Todas menos canceladas</option>
              {SALE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </option>
              ))}
              <option value="todas">Todas</option>
            </select>
          </label>
          <label>
            Cliente
            <input type="search" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nome, @, e-mail ou WhatsApp" />
          </label>
          <label>
            Preço de
            <input inputMode="decimal" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="R$ mín." />
          </label>
          <label>
            até
            <input inputMode="decimal" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="R$ máx." />
          </label>
          <label>
            Origem
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Site e lançadas à mão</option>
              <option value="site">Só do site</option>
              <option value="manual">Só lançadas à mão</option>
            </select>
          </label>
          <label className="adm-check">
            <input type="checkbox" checked={onlyNoCost} onChange={(e) => setOnlyNoCost(e.target.checked)} />
            Só vendas sem custo informado
          </label>
          {activeFilterCount > 0 && (
            <button type="button" className="btn ghost" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Resumo do que está filtrado */}
      <div className="adm-stats">
        <div className="adm-stat">
          <span>Vendas</span>
          <strong>{totals.count}</strong>
        </div>
        <div className="adm-stat">
          <span>Faturamento</span>
          <strong>{money(totals.revenue)}</strong>
        </div>
        <div className="adm-stat is-profit">
          <span>Lucro</span>
          <strong>{totals.withCost ? money(totals.profit) : '—'}</strong>
          {totals.margin !== null && <small>margem de {totals.margin.toFixed(0)}%</small>}
        </div>
        <div className="adm-stat">
          <span>Ticket médio</span>
          <strong>{money(totals.ticket)}</strong>
        </div>
      </div>

      {totals.noCost > 0 && (
        <p className="adm-note">
          ⚠ {totals.noCost} venda{totals.noCost > 1 ? 's' : ''} sem custo informado — o lucro só conta as vendas com
          custo.{' '}
          {!onlyNoCost && (
            <button type="button" className="adm-link" onClick={() => setOnlyNoCost(true)}>
              Mostrar só essas
            </button>
          )}
        </p>
      )}

      {pendingInView.length > 0 && (
        <p className="adm-note">
          ⏳ {pendingInView.length} venda{pendingInView.length > 1 ? 's' : ''} ainda “a entregar” aqui.{' '}
          <button type="button" className="adm-link" onClick={concludeAllInView}>
            Marcar todas como concluídas
          </button>
        </p>
      )}
      {bulkMsg && <p className="adm-note">{bulkMsg}</p>}

      <div className="adm-sales-grid">
        <div className="adm-card">
          <h3>Mês a mês</h3>
          {monthly.avg && (
            <p className="adm-avg">
              <strong>Média mensal</strong> ({monthly.avg.months} {monthly.avg.months === 1 ? 'mês' : 'meses'}):{' '}
              {monthly.avg.count.toFixed(1).replace('.', ',')} vendas · {money(monthly.avg.revenue)} de faturamento
              {totals.withCost > 0 && <> · {money(monthly.avg.profit)} de lucro</>}
            </p>
          )}
          {monthly.rows.length === 0 ? (
            <p className="adm-empty">Nenhuma venda nesse filtro.</p>
          ) : (
            <table className="adm-month-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th aria-label="Faturamento no gráfico" />
                  <th>Vendas</th>
                  <th>Faturamento</th>
                  <th>Lucro</th>
                </tr>
              </thead>
              <tbody>
                {monthly.rows.map((r) => (
                  <tr key={r.key} title={`${monthLabel(r.key)}: ${r.count} vendas, ${money(r.revenue)}`}>
                    <td>{monthLabel(r.key)}</td>
                    <td className="adm-bar-cell">
                      <span className="adm-bar" style={{ width: `${(r.revenue / maxRevenue) * 100}%` }} />
                    </td>
                    <td>{r.count}</td>
                    <td>{money(r.revenue)}</td>
                    <td>{totals.withCost ? money(r.profit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="adm-card">
          <h3>Jogos que mais vendem</h3>
          {topGames.length === 0 ? (
            <p className="adm-empty">Nenhuma venda nesse filtro.</p>
          ) : (
            <ol className="adm-rank">
              {topGames.map((g) => (
                <li key={g.name}>
                  <button type="button" className="adm-rank-name" onClick={() => { setGame(g.name); setShowFilters(true); }} title="Filtrar por esse jogo">
                    {g.name}
                  </button>
                  <span>
                    {g.count}× · {money(g.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="adm-card">
        <h3>
          Vendas <span className="adm-muted">({filtered.length})</span>
        </h3>
        {filtered.length === 0 ? (
          <p className="adm-empty">Nenhuma venda com esses filtros.</p>
        ) : (
          <div className="adm-sale-list">
            <div className="adm-sale-row is-head" aria-hidden="true">
              <span>Data e hora</span>
              <span>Jogo / cliente</span>
              <span>Pagamento</span>
              <span>Preço</span>
              <span>Custo</span>
              <span>Lucro</span>
              <span />
            </div>
            {filtered.slice(0, visible).map((o) => (
              <SaleRow key={o.id} order={o} suggestion={lastCost.get(o.game_name) ?? null} onEdit={() => setEditing(o)} />
            ))}
          </div>
        )}
        {filtered.length > visible && (
          <button type="button" className="btn ghost adm-more" onClick={() => setVisible((v) => v + 60)}>
            Ver mais vendas ({filtered.length - visible} restantes)
          </button>
        )}
      </div>

      {editing && (
        <SaleForm
          order={editing === 'new' ? null : editing}
          games={games}
          gameNames={gameNames}
          lastCost={lastCost}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function SaleRow({ order: o, suggestion, onEdit }: { order: Order; suggestion: number | null; onEdit: () => void }) {
  const router = useRouter();
  const cost = toNumber(o.cost);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profit = saleProfit(o);
  const st = normalizeStatus(o.status);

  async function saveCost(value: string) {
    if (!value.trim() || saving) return;
    setSaving(true);
    setError(null);
    const r = await setSaleCostAction(o.id, value);
    setSaving(false);
    if (r.ok) {
      setDraft('');
      router.refresh();
    } else setError(r.error);
  }

  return (
    <div className={`adm-sale-row${st === 'cancelado' ? ' is-cancelled' : ''}`}>
      <span className="adm-sale-date">
        {formatDay(o.created_at)}
        <small>{formatTime(o.created_at)}</small>
      </span>
      <span className="adm-sale-main">
        <strong>{o.game_name}</strong>
        <small>
          {saleCustomer(o)}
          {o.source === 'manual' && <em className="adm-tag">lançada à mão</em>}
          {st !== 'concluido' && <em className={`adm-tag is-${st}`}>{statusLabel(o.status)}</em>}
        </small>
      </span>
      <span className="adm-sale-pay">{paymentLabel(o.payment_method)}</span>
      <span className="adm-sale-price">{money(toNumber(o.price) ?? 0)}</span>
      <span className="adm-sale-cost">
        {cost !== null ? (
          money(cost)
        ) : (
          <span className="adm-cost-input">
            <input
              inputMode="decimal"
              placeholder="custo"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCost(draft)}
              onBlur={() => saveCost(draft)}
              aria-label={`Custo de ${o.game_name}`}
              disabled={saving}
            />
            {suggestion !== null && !draft && (
              <button type="button" className="adm-link" onClick={() => saveCost(String(suggestion))} title="Usar o último custo desse jogo">
                usar {formatPriceBR(suggestion)}
              </button>
            )}
            {error && <small className="adm-error">{error}</small>}
          </span>
        )}
      </span>
      <span className={`adm-sale-profit${profit !== null && profit < 0 ? ' is-neg' : ''}`}>
        {profit === null ? '—' : money(profit)}
      </span>
      <span>
        <button type="button" className="btn ghost adm-edit" onClick={onEdit}>
          ✏️ Editar
        </button>
      </span>
    </div>
  );
}

function toInput(o: Order | null, today: string): SaleInput {
  if (!o) {
    return {
      gameId: null,
      gameName: '',
      price: '',
      customerName: '',
      customerEmail: '',
      customerWhatsapp: '',
      paymentMethod: 'pix',
      status: 'concluido',
      cost: '',
      fee: '',
      notes: '',
      date: today,
      time: formatTime(new Date())
    };
  }
  const fmt = (v: string | null | undefined) => (toNumber(v) === null ? '' : formatPriceBR(toNumber(v)!));
  return {
    gameId: o.game_id,
    gameName: o.game_name,
    price: fmt(o.price),
    customerName: o.customer_name ?? '',
    customerEmail: o.customer_email ?? '',
    customerWhatsapp: o.customer_whatsapp ? o.customer_whatsapp.replace(/^55/, '') : '',
    paymentMethod: PAYMENT_METHODS.some((m) => m.id === o.payment_method) ? o.payment_method : 'outro',
    status: normalizeStatus(o.status),
    cost: fmt(o.cost),
    fee: fmt(o.fee),
    notes: o.notes ?? '',
    date: dayKey(o.created_at),
    time: formatTime(o.created_at)
  };
}

function SaleForm({
  order,
  games,
  gameNames,
  lastCost,
  onClose
}: {
  order: Order | null;
  games: Game[];
  gameNames: string[];
  lastCost: Map<string, number>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SaleInput>(() => toInput(order, dayKey(new Date())));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = order === null;

  const catalogNames = useMemo(
    () => Array.from(new Set([...games.filter((g) => !g.archived).map((g) => g.name), ...gameNames])).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [games, gameNames]
  );

  function set<K extends keyof SaleInput>(key: K, value: SaleInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Escolheu um jogo do catálogo: liga a venda ao jogo e, numa venda nova,
  // já preenche o preço atual e o último custo usado.
  function pickGame(name: string) {
    const match = games.find((g) => g.name === name);
    setForm((f) => {
      const next = { ...f, gameName: name, gameId: match ? match.id : null };
      if (isNew && match && !f.price) next.price = formatPriceBR(gamePrice(match).price);
      if (isNew && !f.cost && lastCost.has(name)) next.cost = formatPriceBR(lastCost.get(name)!);
      return next;
    });
  }

  const num = (s: string) => toNumber(s.replace(/\./g, '').replace(',', '.'));
  const price = num(form.price);
  const cost = num(form.cost);
  const preview = price !== null && cost !== null ? price - cost - (num(form.fee) ?? 0) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = isNew ? await createManualSaleAction(form) : await updateSaleAction(order.id, form);
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!order || !confirm(`Apagar de vez a venda de ${order.game_name}? Isso não dá pra desfazer. (Se só não aconteceu, prefira marcar como "Cancelada".)`)) return;
    await deleteOrderAction(order.id);
    router.refresh();
    onClose();
  }

  return (
    <div className="adm-modal" role="dialog" aria-modal="true" aria-label={isNew ? 'Lançar venda' : 'Editar venda'} onClick={onClose}>
      <form className="adm-modal-card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-head">
          <h3>{isNew ? '＋ Lançar venda' : `✏️ Venda #${order.id}`}</h3>
          <button type="button" className="adm-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {isNew && <p className="adm-help">Pra vendas feitas fora do site (direct, WhatsApp, pessoalmente).</p>}

        <div className="adm-form-grid">
          <label className="is-wide">
            Jogo *
            <input list="adm-game-names" value={form.gameName} onChange={(e) => pickGame(e.target.value)} placeholder="Comece a digitar o nome" required />
            <datalist id="adm-game-names">
              {catalogNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label>
            Data *
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </label>
          <label>
            Hora
            <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </label>
          <label>
            Pagamento *
            <select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor da venda (R$) *
            <input inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="199,90" required />
          </label>
          <label>
            Custo da chave (R$)
            <input inputMode="decimal" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="quanto você pagou" />
          </label>
          <label>
            Taxa extra (R$)
            <input inputMode="decimal" value={form.fee} onChange={(e) => set('fee', e.target.value)} placeholder="normalmente vazio" />
            <small>Só se saiu do seu bolso — a taxa do Mercado Pago já é paga pelo cliente.</small>
          </label>
          <div className={`adm-profit-preview${preview !== null && preview < 0 ? ' is-neg' : ''}`}>
            <span>Lucro desta venda</span>
            <strong>{preview === null ? 'informe o custo' : money(preview)}</strong>
          </div>
          <label>
            Cliente (nome ou @)
            <input value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="@cliente" />
          </label>
          <label>
            E-mail do cliente
            <input type="email" value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} />
          </label>
          <label>
            WhatsApp do cliente
            <input inputMode="tel" value={form.customerWhatsapp} onChange={(e) => set('customerWhatsapp', e.target.value)} placeholder="21 99999-8888" />
          </label>
          <label>
            Situação
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {SALE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="is-wide">
            Observação
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Qualquer anotação sobre essa venda" />
          </label>
        </div>

        {error && <p className="adm-error">{error}</p>}

        <div className="adm-modal-actions">
          {!isNew && (
            <button type="button" className="btn ghost adm-danger" onClick={remove}>
              🗑 Apagar venda
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'Salvando…' : isNew ? 'Lançar venda' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
