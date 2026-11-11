'use client';

// Promoções e eventos (/admin > 🏷️ Promoções): escolhe vários jogos de uma
// vez, um desconto (R$ ou %), a etiqueta que aparece no site e quando
// começa/termina. Regras em lib/promoEvents.ts; gravação em
// promoEventActions.ts.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Game } from '@/lib/db';
import { gamePrice } from '@/lib/gamePrice';
import { getContrastColor } from '@/lib/color';
import { formatPriceBR } from '@/lib/whatsapp';
import { EVENT_STATUS_LABEL, eventStatus, priceWithEvent, type DiscountType, type PromoEventRow } from '@/lib/promoEvents';
import {
  deletePromoEventAction,
  savePromoEventAction,
  setPromoEventEnabledAction,
  type PromoEventInput
} from './promoEventActions';

const TZ = 'America/Sao_Paulo';
const COLOR_PRESETS = [
  { color: '#111111', label: 'Preto' },
  { color: '#e11d48', label: 'Vermelho' },
  { color: '#7b2ff0', label: 'Roxo' },
  { color: '#ffd24e', label: 'Dourado' },
  { color: '#16a34a', label: 'Verde' },
  { color: '#2563eb', label: 'Azul' }
];

// Date → "2026-11-27T00:00" no horário de Brasília (pro campo datetime-local).
function toLocalInput(d: Date | string): string {
  return new Date(d).toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T').slice(0, 16);
}
function formatWhen(d: Date | string): string {
  return new Date(d).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function discountLabel(type: DiscountType, value: number): string {
  return type === 'percent' ? `${formatPriceBR(value).replace(',00', '')}% de desconto` : `R$ ${formatPriceBR(value)} de desconto`;
}
// Preço do jogo sem nenhum evento (o promocional, se houver).
function basePrice(g: Game): number {
  return gamePrice({ ...g, promo_event: null }).price;
}

function blankInput(): PromoEventInput {
  const year = new Date().getFullYear();
  return {
    id: null,
    name: `Black Friday ${year}`,
    tagText: 'BLACK FRIDAY',
    tagColor: '#111111',
    discountType: 'fixed',
    discountValue: '15',
    startsAt: '',
    endsAt: '',
    enabled: true,
    gameIds: []
  };
}

function rowToInput(e: PromoEventRow, copy = false): PromoEventInput {
  return {
    id: copy ? null : e.id,
    name: copy ? `${e.name} (cópia)` : e.name,
    tagText: e.tag_text,
    tagColor: e.tag_color,
    discountType: e.discount_type,
    discountValue: formatPriceBR(parseFloat(e.discount_value)).replace(',00', ''),
    startsAt: copy ? '' : toLocalInput(e.starts_at),
    endsAt: copy || !e.ends_at ? '' : toLocalInput(e.ends_at),
    enabled: copy ? true : e.enabled,
    gameIds: e.game_ids
  };
}

export default function PromoEventsPanel({ games, events }: { games: Game[]; events: PromoEventRow[] | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PromoEventInput | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  async function toggle(e: PromoEventRow) {
    const r = await setPromoEventEnabledAction(e.id, !e.enabled);
    setMessage(r.ok ? (e.enabled ? `⏸ "${e.name}" pausada — os preços voltaram ao normal.` : `▶ "${e.name}" reativada.`) : r.error);
    router.refresh();
  }
  async function remove(e: PromoEventRow) {
    if (!confirm(`Apagar a promoção "${e.name}"? Os jogos voltam ao preço normal. (Pra só parar por um tempo, use "Pausar".)`)) return;
    const r = await deletePromoEventAction(e.id);
    setMessage(r.ok ? `🗑 "${e.name}" apagada.` : r.error);
    router.refresh();
  }

  return (
    <section>
      <div className="adm-section-head">
        <div>
          <h2>🏷️ Promoções e eventos</h2>
          <p className="adm-help">
            Crie uma promoção pra vários jogos de uma vez (ex: <strong>Black Friday</strong>): escolha os jogos, o
            desconto, a etiqueta que aparece no site e quando começa. Na hora marcada, os preços mudam sozinhos em
            todo o site (catálogo, Pix e cartão) e voltam ao normal quando terminar.
          </p>
        </div>
        {events !== null && !editing && (
          <div className="adm-head-actions">
            <button type="button" className="btn primary" onClick={() => { setEditing(blankInput()); setMessage(null); }}>
              ＋ Nova promoção
            </button>
          </div>
        )}
      </div>

      {events === null && (
        <p className="adm-note">
          ⚠ Pra usar as promoções, rode uma vez o arquivo <code>db/migration-eventos-promocao.sql</code> no Neon e
          atualize esta página.
        </p>
      )}
      {message && <p className="adm-note">{message}</p>}

      {editing && (
        <EventEditor
          key={editing.id ?? 'new'}
          initial={editing}
          games={games}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            setMessage(`✓ "${name}" salva.`);
            router.refresh();
          }}
        />
      )}

      {events !== null && !editing && (
        events.length === 0 ? (
          <div className="adm-card">
            <p className="adm-empty">Nenhuma promoção criada ainda. Clique em “＋ Nova promoção” pra começar.</p>
          </div>
        ) : (
          <div className="adm-event-list">
            {events.map((e) => {
              const status = eventStatus(e);
              const value = parseFloat(e.discount_value);
              const names = e.game_ids.map((id) => gameById.get(id)?.name).filter(Boolean) as string[];
              return (
                <div key={e.id} className={`adm-card adm-event is-${status}`}>
                  <div className="adm-event-top">
                    <span className="adm-event-tag" style={{ background: e.tag_color, color: getContrastColor(e.tag_color) }}>
                      {e.tag_text}
                    </span>
                    <span className="adm-event-status">{EVENT_STATUS_LABEL[status]}</span>
                  </div>
                  <h3>{e.name}</h3>
                  <p className="adm-event-meta">
                    <strong>{discountLabel(e.discount_type, value)}</strong> em {e.game_ids.length}{' '}
                    {e.game_ids.length === 1 ? 'jogo' : 'jogos'}
                  </p>
                  <p className="adm-event-meta">
                    Começa {formatWhen(e.starts_at)} · {e.ends_at ? `termina ${formatWhen(e.ends_at)}` : 'sem data pra terminar'}
                  </p>
                  {names.length > 0 && (
                    <p className="adm-event-games" title={names.join(', ')}>
                      {names.slice(0, 6).join(', ')}
                      {names.length > 6 ? ` e mais ${names.length - 6}` : ''}
                    </p>
                  )}
                  <div className="adm-event-actions">
                    <button type="button" className="btn ghost" onClick={() => { setEditing(rowToInput(e)); setMessage(null); }}>
                      ✏️ Editar
                    </button>
                    <button type="button" className="btn ghost" onClick={() => toggle(e)}>
                      {e.enabled ? '⏸ Pausar' : '▶ Reativar'}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => { setEditing(rowToInput(e, true)); setMessage(null); }} title="Criar outra promoção com os mesmos jogos e desconto">
                      ⧉ Duplicar
                    </button>
                    <button type="button" className="btn ghost adm-danger" onClick={() => remove(e)}>
                      🗑 Apagar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}

function EventEditor({
  initial,
  games,
  onClose,
  onSaved
}: {
  initial: PromoEventInput;
  games: Game[];
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [form, setForm] = useState<PromoEventInput>(initial);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initial.gameIds));
  const [hasEnd, setHasEnd] = useState(Boolean(initial.endsAt));
  const [query, setQuery] = useState('');
  const [franchise, setFranchise] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PromoEventInput>(key: K, value: PromoEventInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const activeGames = useMemo(
    () => games.filter((g) => !g.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [games]
  );
  const franchises = useMemo(
    () => Array.from(new Set(activeGames.map((g) => g.franchise).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [activeGames]
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeGames.filter(
      (g) =>
        (!q || g.name.toLowerCase().includes(q)) &&
        (!franchise || g.franchise === franchise) &&
        (!onlySelected || selected.has(g.id))
    );
  }, [activeGames, query, franchise, onlySelected, selected]);

  const value = Number(form.discountValue.trim().replace(/\./g, '').replace(',', '.'));
  const validValue = Number.isFinite(value) && value > 0 ? value : 0;
  const type = form.discountType as DiscountType;
  const previewPercent = useMemo(() => {
    const g = activeGames.find((x) => selected.has(x.id)) ?? activeGames[0];
    if (!g) return null;
    const base = basePrice(g);
    const p = priceWithEvent(base, type, validValue);
    return p < base ? Math.round((1 - p / base) * 100) : null;
  }, [activeGames, selected, type, validValue]);

  function toggleGame(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectVisible(add: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      for (const g of visible) {
        if (add) next.add(g.id);
        else next.delete(g.id);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const r = await savePromoEventAction({ ...form, endsAt: hasEnd ? form.endsAt : '', gameIds: Array.from(selected) });
    setSaving(false);
    if (r.ok) onSaved(form.name);
    else setError(r.error);
  }

  return (
    <div className="adm-card adm-event-editor admin-panel">
      <div className="adm-modal-head">
        <h3>{initial.id ? '✏️ Editar promoção' : '＋ Nova promoção'}</h3>
        <button type="button" className="adm-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <ol className="adm-steps">
        <li>
          <h4>1. Nome e etiqueta</h4>
          <div className="adm-form-grid">
            <label>
              Nome da promoção (só você vê)
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Black Friday 2026" />
            </label>
            <label>
              Texto da etiqueta no site
              <input value={form.tagText} onChange={(e) => set('tagText', e.target.value.toUpperCase())} placeholder="BLACK FRIDAY" maxLength={24} />
            </label>
            <div className="is-wide adm-color-row">
              <span className="adm-label">Cor da etiqueta</span>
              <div className="adm-swatches">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    className={`adm-swatch${form.tagColor.toLowerCase() === c.color ? ' is-on' : ''}`}
                    style={{ background: c.color }}
                    onClick={() => set('tagColor', c.color)}
                    aria-label={c.label}
                    title={c.label}
                  />
                ))}
                <label className="adm-swatch-custom" title="Outra cor">
                  <input type="color" value={form.tagColor} onChange={(e) => set('tagColor', e.target.value)} aria-label="Escolher outra cor" />
                  outra cor
                </label>
              </div>
              <span className="adm-label">Como vai aparecer:</span>
              <span className="adm-event-tag is-preview" style={{ background: form.tagColor, color: getContrastColor(form.tagColor) }}>
                {(form.tagText || 'ETIQUETA').toUpperCase()} -{previewPercent ?? 'X'}%
              </span>
            </div>
          </div>
        </li>

        <li>
          <h4>2. Desconto</h4>
          <div className="adm-discount-row">
            <div className="adm-chips" role="group" aria-label="Tipo de desconto">
              <button type="button" className={`adm-chip${type === 'fixed' ? ' is-on' : ''}`} onClick={() => set('discountType', 'fixed')}>
                R$ a menos
              </button>
              <button type="button" className={`adm-chip${type === 'percent' ? ' is-on' : ''}`} onClick={() => set('discountType', 'percent')}>
                % a menos
              </button>
            </div>
            <label className="adm-discount-value">
              <span>{type === 'fixed' ? 'R$' : '%'}</span>
              <input inputMode="decimal" value={form.discountValue} onChange={(e) => set('discountValue', e.target.value)} aria-label="Valor do desconto" />
            </label>
          </div>
          <p className="adm-help">
            O desconto entra em cima do preço que o jogo já tem (inclusive se ele já estiver em promoção). Nenhum jogo
            fica abaixo de R$ 1,00.
          </p>
        </li>

        <li>
          <h4>3. Quando</h4>
          <div className="adm-form-grid">
            <label>
              Começa em (horário de Brasília)
              <input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
            </label>
            <label>
              <span className="adm-check">
                <input type="checkbox" checked={hasEnd} onChange={(e) => setHasEnd(e.target.checked)} />
                Tem data pra terminar
              </span>
              {hasEnd && <input type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />}
            </label>
          </div>
          <p className="adm-help">
            Antes da hora marcada nada muda no site. Depois de salvar, a promoção pode levar até 5 minutos pra aparecer
            pros clientes na hora em que começar.
          </p>
        </li>

        <li>
          <h4>
            4. Jogos <span className="adm-muted">({selected.size} selecionado{selected.size === 1 ? '' : 's'})</span>
          </h4>
          <div className="adm-filters adm-event-filters">
            <label>
              Buscar
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome do jogo" />
            </label>
            <label>
              Franquia
              <select value={franchise} onChange={(e) => setFranchise(e.target.value)}>
                <option value="">Todas</option>
                {franchises.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-check">
              <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
              Ver só os selecionados
            </label>
          </div>
          <div className="adm-shortcuts" style={{ marginBottom: 10 }}>
            <button type="button" className="btn ghost" onClick={() => selectVisible(true)}>
              ☑ Selecionar {query || franchise ? 'os da lista' : 'todos'} ({visible.length})
            </button>
            <button type="button" className="btn ghost" onClick={() => selectVisible(false)}>
              ☐ Desmarcar {query || franchise ? 'os da lista' : 'todos'}
            </button>
          </div>
          <div className="adm-game-picker">
            {visible.length === 0 ? (
              <p className="adm-empty">Nenhum jogo com esse filtro.</p>
            ) : (
              visible.map((g) => {
                const base = basePrice(g);
                const after = priceWithEvent(base, type, validValue);
                const on = selected.has(g.id);
                return (
                  <label key={g.id} className={`adm-pick${on ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleGame(g.id)} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.image_url || ''} alt="" loading="lazy" />
                    <span className="adm-pick-name">{g.name}</span>
                    <span className="adm-pick-price">
                      {on && after < base ? (
                        <>
                          <s>R$ {formatPriceBR(base)}</s> <strong>R$ {formatPriceBR(after)}</strong>
                        </>
                      ) : (
                        <>R$ {formatPriceBR(base)}</>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </li>
      </ol>

      <label className="adm-check" style={{ marginTop: 14 }}>
        <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
        Promoção ativada (desmarque pra deixar salva, mas pausada)
      </label>

      {error && <p className="adm-error">{error}</p>}

      <div className="adm-modal-actions">
        <span style={{ flex: 1 }} />
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : `Salvar promoção (${selected.size} ${selected.size === 1 ? 'jogo' : 'jogos'})`}
        </button>
      </div>
    </div>
  );
}
