'use client';

// Preço automático pela Amazon JP (/admin > 🎮 Jogos). Mostra a última
// conferência, deixa mudar margem/acréscimo, rodar agora e ligar/desligar
// jogo por jogo. Regras em lib/autoPricing.ts.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Game } from '@/lib/db';
import { autoPriceTarget } from '@/lib/amazonPrice';
import type { AutoPriceRun, AutoPriceSettings } from '@/lib/autoPricing';
import { formatPriceBR } from '@/lib/whatsapp';
import { runAutoPricingNowAction, setGameAutoPriceAction, updateAutoPriceSettingsAction } from './autoPriceActions';

const TZ = 'America/Sao_Paulo';
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const num = (s: string) => Number(s.trim().replace(',', '.'));
const small: React.CSSProperties = { fontSize: 12.5, color: 'var(--ink-dim)' };

export default function AutoPricePanel({
  games,
  settings,
  lastRun
}: {
  games: Game[];
  settings: AutoPriceSettings;
  lastRun: AutoPriceRun | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [margin, setMargin] = useState(String(settings.margin).replace('.', ','));
  const [spread, setSpread] = useState(String(settings.spread).replace('.', ','));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [run, setRun] = useState<AutoPriceRun | null>(lastRun);
  const [autoMap, setAutoMap] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(games.map((g) => [g.id, g.auto_price]))
  );

  const raised = run?.items.filter((i) => i.status === 'raised') ?? [];
  const problems = run?.items.filter((i) => i.status === 'error' || i.status === 'suspicious') ?? [];
  const capped = run?.items.filter((i) => i.capped) ?? [];

  const list = useMemo(
    () =>
      games
        .filter((g) => !g.archived)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map((g) => {
          const t =
            run && g.amazon_yen
              ? autoPriceTarget(g.amazon_yen, run.rate, { margin: num(margin) || 0, spread: num(spread) || 0 }, g.original_price ? parseFloat(g.original_price) : null)
              : null;
          return { g, t };
        }),
    [games, run, margin, spread]
  );

  async function save() {
    setBusy('save');
    setMsg(null);
    const r = await updateAutoPriceSettingsAction(enabled, num(margin), num(spread));
    setBusy(null);
    setMsg(r.ok ? 'Configuração salva.' : r.error);
    if (r.ok) router.refresh();
  }

  async function runNow() {
    setBusy('run');
    setMsg('Consultando a Amazon Japão... leva uns 30 segundos.');
    const r = await runAutoPricingNowAction();
    setBusy(null);
    if (!r.ok) return setMsg(r.error);
    setRun(r.run);
    const up = r.run.items.filter((i) => i.status === 'raised').length;
    setMsg(`Pronto! ${r.run.items.length} jogos conferidos, ${up} subiram.`);
    router.refresh();
  }

  async function toggleGame(id: number, value: boolean) {
    setAutoMap((m) => ({ ...m, [id]: value }));
    const r = await setGameAutoPriceAction(id, value);
    if (!r.ok) {
      setAutoMap((m) => ({ ...m, [id]: !value }));
      setMsg(r.error);
    }
  }

  return (
    <div className="adm-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>💴 Preço automático (Amazon Japão)</h3>
          <p style={{ ...small, margin: '4px 0 0' }}>
            {!enabled
              ? 'Desligado — os preços não estão sendo conferidos.'
              : run
                ? `Última conferência: ${fmtWhen(run.at)} · ¥1 = R$ ${run.rate.toFixed(5).replace('.', ',')} · ${raised.length} subiram · ${problems.length} com problema`
                : 'Ainda não rodou nenhuma vez.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn primary" onClick={runNow} disabled={busy !== null}>
            {busy === 'run' ? 'Atualizando...' : '🔄 Atualizar agora'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Fechar' : 'Detalhes'}
          </button>
        </div>
      </div>
      {msg && <p style={{ margin: '10px 0 0', fontSize: 14 }}>{msg}</p>}

      {open && (
        <div style={{ marginTop: 14 }}>
          <p style={small}>
            Todo dia às 7h o site lê o preço em ienes de cada jogo na Amazon Japão, converte pela cotação do dia
            e soma o acréscimo do cartão. Se o preço daqui estiver abaixo de <strong>custo + margem</strong>, ele
            sobe pra esse valor arredondado pra cima (múltiplo de R$5). Nunca baixa sozinho e nunca passa do
            preço da eShop (o "preço original" do jogo). Você recebe o resumo no Telegram.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', margin: '12px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />
              Ligado
            </label>
            <div>
              <label htmlFor="apMargin">Margem (R$)</label>
              <input id="apMargin" value={margin} onChange={(e) => setMargin(e.target.value)} inputMode="decimal" style={{ maxWidth: 110 }} />
            </div>
            <div>
              <label htmlFor="apSpread">Acréscimo do cartão/IOF (%)</label>
              <input id="apSpread" value={spread} onChange={(e) => setSpread(e.target.value)} inputMode="decimal" style={{ maxWidth: 110 }} />
            </div>
            <button type="button" className="btn ghost" onClick={save} disabled={busy !== null}>
              {busy === 'save' ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          {raised.length > 0 && (
            <>
              <h4 style={{ margin: '14px 0 6px' }}>⬆️ Subiram na última conferência</h4>
              {raised.map((i) => (
                <div key={i.id} style={{ fontSize: 14 }}>
                  {i.name}: R$ {formatPriceBR(i.oldPrice)} → <strong>R$ {formatPriceBR(i.newPrice)}</strong> (¥{i.yen?.toLocaleString('pt-BR')})
                </div>
              ))}
            </>
          )}
          {capped.length > 0 && (
            <>
              <h4 style={{ margin: '14px 0 6px' }}>⚠️ Margem menor por causa do teto da eShop</h4>
              {capped.map((i) => (
                <div key={i.id} style={{ fontSize: 14 }}>
                  {i.name}: custo R$ {formatPriceBR(i.cost ?? 0)}, preço R$ {formatPriceBR(i.newPrice)}
                </div>
              ))}
            </>
          )}
          {problems.length > 0 && (
            <>
              <h4 style={{ margin: '14px 0 6px' }}>❌ Não consegui conferir</h4>
              {problems.map((i) => (
                <div key={i.id} style={{ fontSize: 14 }}>
                  {i.name}: {i.error}
                </div>
              ))}
            </>
          )}

          <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={() => setShowGames((s) => !s)}>
            {showGames ? 'Esconder jogos' : 'Ver todos os jogos / ligar e desligar'}
          </button>
          {showGames && (
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--ink-dim)' }}>
                    <th style={{ padding: 6 }}>Auto</th>
                    <th style={{ padding: 6 }}>Jogo</th>
                    <th style={{ padding: 6 }}>Amazon</th>
                    <th style={{ padding: 6 }}>Custo</th>
                    <th style={{ padding: 6 }}>Mínimo</th>
                    <th style={{ padding: 6 }}>Preço</th>
                    <th style={{ padding: 6 }}>eShop</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(({ g, t }) => {
                    const price = parseFloat(g.price);
                    const below = t !== null && price < t.minimum;
                    return (
                      <tr key={g.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                        <td style={{ padding: 6 }}>
                          <input
                            type="checkbox"
                            aria-label={`Preço automático: ${g.name}`}
                            checked={autoMap[g.id] ?? true}
                            onChange={(e) => toggleGame(g.id, e.target.checked)}
                            disabled={!g.amazon_jp_url}
                            style={{ width: 16, height: 16, accentColor: 'var(--green)' }}
                          />
                        </td>
                        <td style={{ padding: 6 }}>
                          {g.name}
                          {!g.amazon_jp_url && <span style={small}> (sem link)</span>}
                          {g.amazon_error && <div style={{ ...small, color: '#ff8a8a' }}>{g.amazon_error}</div>}
                        </td>
                        <td style={{ padding: 6 }}>{g.amazon_yen ? `¥${g.amazon_yen.toLocaleString('pt-BR')}` : '—'}</td>
                        <td style={{ padding: 6 }}>{t ? `R$ ${formatPriceBR(t.cost)}` : '—'}</td>
                        <td style={{ padding: 6 }}>{t ? `R$ ${formatPriceBR(t.minimum)}` : '—'}</td>
                        <td style={{ padding: 6, color: below ? '#ff8a8a' : undefined, fontWeight: below ? 700 : undefined }}>
                          R$ {formatPriceBR(price)}
                        </td>
                        <td style={{ padding: 6 }}>{g.original_price ? `R$ ${formatPriceBR(parseFloat(g.original_price))}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
