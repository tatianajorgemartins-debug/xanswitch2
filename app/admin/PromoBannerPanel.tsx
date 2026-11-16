'use client';

// Banner promocional (/admin > 🏷️ Promoções): uma imagem que entra no lugar
// dos banners de "Destaque da semana" na página inicial, com datas próprias
// (não dependem das datas das promoções). Regras em lib/promoBanner.ts;
// gravação em promoBannerActions.ts.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EVENT_STATUS_LABEL } from '@/lib/promoEvents';
import { promoBannerStatus, type PromoBannerSetting } from '@/lib/promoBanner';
import { removePromoBannerAction, savePromoBannerAction, setPromoBannerEnabledAction } from './promoBannerActions';

const TZ = 'America/Sao_Paulo';

function toLocalInput(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T').slice(0, 16);
}
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PromoBannerPanel({ banner }: { banner: PromoBannerSetting | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!banner) return;
    setBusy(true);
    const r = await setPromoBannerEnabledAction(!banner.enabled);
    setBusy(false);
    setMessage(r.ok ? (banner.enabled ? '⏸ Banner pausado — os destaques da semana voltaram.' : '▶ Banner reativado.') : r.error);
    router.refresh();
  }
  async function remove() {
    if (!confirm('Apagar o banner promocional? Os banners de destaque da semana voltam a aparecer.')) return;
    setBusy(true);
    const r = await removePromoBannerAction();
    setBusy(false);
    setMessage(r.ok ? '🗑 Banner apagado.' : r.error);
    router.refresh();
  }

  const status = banner ? promoBannerStatus(banner) : null;

  return (
    <section style={{ marginBottom: 28 }}>
      <div className="adm-section-head">
        <div>
          <h2>🖼️ Banner promocional</h2>
          <p className="adm-help">
            Uma arte sua (ex: <strong>Black Friday</strong>) que entra no lugar dos banners de “Destaque da semana” na
            página inicial. Você escolhe quando ele aparece e quando sai — as datas são só do banner, separadas das
            promoções. Fora desse período, os destaques da semana voltam sozinhos.
          </p>
        </div>
        {!editing && !banner && (
          <div className="adm-head-actions">
            <button type="button" className="btn primary" onClick={() => { setEditing(true); setMessage(null); }}>
              ＋ Colocar banner
            </button>
          </div>
        )}
      </div>

      {message && <p className="adm-note">{message}</p>}

      {editing ? (
        <BannerEditor
          banner={banner}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setMessage('✓ Banner salvo.');
            router.refresh();
          }}
        />
      ) : banner && status ? (
        <div className={`adm-card adm-event is-${status}`}>
          <div className="adm-event-top">
            <span className="adm-event-status">{EVENT_STATUS_LABEL[status]}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.imageUrl} alt="" className="adm-banner-thumb" />
          <p className="adm-event-meta">
            Aparece a partir de {formatWhen(banner.startsAt)} ·{' '}
            {banner.endsAt ? `sai em ${formatWhen(banner.endsAt)}` : 'sem data pra sair'}
          </p>
          <p className="adm-event-meta">
            Ao clicar: {banner.action === 'sale' ? 'mostra só os jogos em promoção' : 'não faz nada (só imagem)'}
            {banner.mobileImageUrl ? ' · com arte própria pro celular' : ''}
          </p>
          <div className="adm-event-actions">
            <button type="button" className="btn ghost" disabled={busy} onClick={() => { setEditing(true); setMessage(null); }}>
              ✏️ Editar
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={toggle}>
              {banner.enabled ? '⏸ Pausar' : '▶ Reativar'}
            </button>
            <button type="button" className="btn ghost adm-danger" disabled={busy} onClick={remove}>
              🗑 Apagar
            </button>
          </div>
        </div>
      ) : (
        <div className="adm-card">
          <p className="adm-empty">Nenhum banner promocional. A página inicial está mostrando os destaques da semana.</p>
        </div>
      )}
    </section>
  );
}

function BannerEditor({
  banner,
  onClose,
  onSaved
}: {
  banner: PromoBannerSetting | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(banner?.imageUrl ?? null);
  const [mobilePreview, setMobilePreview] = useState<string | null>(banner?.mobileImageUrl ?? null);
  const [removeMobile, setRemoveMobile] = useState(false);
  const [alt, setAlt] = useState(banner?.alt ?? '');
  const [action, setAction] = useState(banner?.action ?? 'sale');
  const [startsAt, setStartsAt] = useState(banner ? toLocalInput(banner.startsAt) : '');
  const [hasEnd, setHasEnd] = useState(Boolean(banner?.endsAt));
  const [endsAt, setEndsAt] = useState(banner?.endsAt ? toLocalInput(banner.endsAt) : '');
  const [enabled, setEnabled] = useState(banner?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const data = new FormData();
    const image = imageRef.current?.files?.[0];
    const mobile = mobileRef.current?.files?.[0];
    if (image) data.set('image', image);
    if (mobile) data.set('mobileImage', mobile);
    if (removeMobile) data.set('removeMobile', '1');
    data.set('alt', alt);
    data.set('action', action);
    data.set('startsAt', startsAt);
    data.set('endsAt', hasEnd ? endsAt : '');
    data.set('enabled', enabled ? '1' : '0');
    try {
      const r = await savePromoBannerAction(data);
      if (r.ok) onSaved();
      else setError(r.error);
    } catch {
      setError('Não deu pra salvar. Se a imagem for muito pesada, tente uma menor (até uns 4 MB).');
    }
    setSaving(false);
  }

  return (
    <div className="adm-card adm-event-editor admin-panel">
      <div className="adm-modal-head">
        <h3>{banner ? '✏️ Editar banner' : '＋ Novo banner'}</h3>
        <button type="button" className="adm-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <ol className="adm-steps">
        <li>
          <h4>1. Imagem</h4>
          <p className="adm-help">
            Tamanho ideal: <strong>1600 × 870</strong> (deitada). No celular o espaço é mais quadrado e as laterais da
            imagem são cortadas, então deixe o texto e o que importa no <strong>centro</strong> — ou envie uma arte
            só pro celular logo abaixo.
          </p>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="adm-banner-thumb" />
          )}
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
          <div className="adm-form-grid" style={{ marginTop: 14 }}>
            <label className="is-wide">
              Arte só pro celular (opcional) — ideal 1000 × 700
              {mobilePreview && !removeMobile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mobilePreview} alt="" className="adm-banner-thumb is-mobile" />
              )}
              <input
                ref={mobileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setMobilePreview(URL.createObjectURL(f));
                    setRemoveMobile(false);
                  }
                }}
              />
            </label>
            {banner?.mobileImageUrl && (
              <label className="adm-check is-wide">
                <input type="checkbox" checked={removeMobile} onChange={(e) => setRemoveMobile(e.target.checked)} />
                Tirar a arte do celular (usar a mesma imagem nos dois)
              </label>
            )}
            <label className="is-wide">
              Descrição da imagem (ajuda quem usa leitor de tela; ex: “Black Friday: até 70% de desconto”)
              <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={120} placeholder="Black Friday XAN Switch" />
            </label>
          </div>
        </li>

        <li>
          <h4>2. Ao clicar no banner</h4>
          <div className="adm-chips" role="group" aria-label="O que acontece ao clicar">
            <button type="button" className={`adm-chip${action === 'sale' ? ' is-on' : ''}`} onClick={() => setAction('sale')}>
              Mostrar os jogos em promoção
            </button>
            <button type="button" className={`adm-chip${action === 'none' ? ' is-on' : ''}`} onClick={() => setAction('none')}>
              Nada (só a imagem)
            </button>
          </div>
        </li>

        <li>
          <h4>3. Quando aparece</h4>
          <div className="adm-form-grid">
            <label>
              Aparece a partir de (horário de Brasília)
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label>
              <span className="adm-check">
                <input type="checkbox" checked={hasEnd} onChange={(e) => setHasEnd(e.target.checked)} />
                Tem data pra sair
              </span>
              {hasEnd && <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}
            </label>
          </div>
          <p className="adm-help">
            Essas datas são só do banner. Dá, por exemplo, pra ele entrar uns dias antes da promoção começar, como
            aviso. Na hora marcada pode levar até 5 minutos pra trocar no site.
          </p>
        </li>
      </ol>

      <label className="adm-check" style={{ marginTop: 14 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Banner ativado (desmarque pra deixar salvo, mas pausado)
      </label>

      {error && <p className="adm-error">{error}</p>}

      <div className="adm-modal-actions">
        <span style={{ flex: 1 }} />
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar banner'}
        </button>
      </div>
    </div>
  );
}
