'use client';

import { useMemo, useRef, useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import type { Game } from '@/lib/db';
import { getContrastColor } from '@/lib/color';
import {
  createGameAction,
  updateGameAction,
  archiveGameAction,
  deleteGameAction,
  logoutAction,
  type GameFormState
} from './actions';

const emptyFormState: GameFormState = { error: null };

export default function AdminClient({ initialGames }: { initialGames: Game[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  const games = initialGames;

  const activeGames = useMemo(
    () =>
      games
        .filter((g) => !g.archived)
        .filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [games, query]
  );
  const archivedGames = useMemo(
    () => games.filter((g) => g.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [games]
  );

  function openAddPanel() {
    setEditingGame(null);
    setPanelOpen(true);
  }
  function openEditPanel(game: Game) {
    setEditingGame(game);
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
    setEditingGame(null);
  }

  async function handleArchive(id: number, archived: boolean) {
    await archiveGameAction(id, archived);
    router.refresh();
  }
  async function handleDelete(id: number, name: string) {
    if (!confirm(`Excluir "${name}" do catálogo? Essa ação não pode ser desfeita.`)) return;
    await deleteGameAction(id);
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div className="brand">
          XAN<span>SWITCH</span>
        </div>
        <p style={{ color: 'var(--ink-dim)', fontSize: 14.5, fontWeight: 600, margin: 0, flex: 1 }}>
          Painel de administração — adicione, edite, arquive e exclua os jogos do catálogo.
        </p>
        <a href="/" target="_blank" rel="noreferrer" className="btn ghost">
          🔗 Ver catálogo público
        </a>
        <form action={logoutAction}>
          <button type="submit" className="btn ghost">
            Sair
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div
          style={{
            flex: 1,
            minWidth: 220,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--panel)',
            border: '1px solid rgba(164,99,255,.3)',
            borderRadius: 10,
            padding: '10px 14px'
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16} style={{ color: 'var(--ink-dim)', flex: 'none' }}>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar jogo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ background: 'none', border: 'none', width: '100%' }}
          />
        </div>
        <button className="btn primary" onClick={openAddPanel}>
          ＋ Adicionar jogo
        </button>
        <button className="btn ghost" onClick={() => setShowArchived((s) => !s)}>
          📦 Arquivados ({archivedGames.length})
        </button>
      </div>

      {panelOpen && (
        <GameFormPanel game={editingGame} onClose={closePanel} onSaved={() => { closePanel(); router.refresh(); }} />
      )}

      {showArchived && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid rgba(164,99,255,.25)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 20
          }}
        >
          {archivedGames.length === 0 ? (
            <p style={{ color: 'var(--ink-dim)', fontSize: 14, padding: '10px 6px' }}>
              Nenhum jogo arquivado.
            </p>
          ) : (
            archivedGames.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 6px',
                  borderBottom: '1px solid rgba(255,255,255,.06)'
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image_url || ''}
                  alt=""
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    objectFit: 'cover',
                    background: 'var(--bg-dark)',
                    border: '1px solid rgba(164,99,255,.3)'
                  }}
                />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{g.name}</span>
                <button className="btn ghost" onClick={() => handleArchive(g.id, false)}>
                  ↺ Restaurar
                </button>
                <button className="btn ghost" onClick={() => handleDelete(g.id, g.name)}>
                  🗑
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeGames.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-dim)' }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            Nenhum jogo ainda. Clique em &quot;＋ Adicionar jogo&quot; pra começar seu catálogo.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 20
          }}
        >
          {activeGames.map((g) => (
            <AdminGameCard
              key={g.id}
              game={g}
              onEdit={() => openEditPanel(g)}
              onArchive={() => handleArchive(g.id, true)}
              onDelete={() => handleDelete(g.id, g.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminGameCard({
  game,
  onEdit,
  onArchive,
  onDelete
}: {
  game: Game;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="octagon"
        style={{
          position: 'relative',
          aspectRatio: '3/4',
          width: '100%',
          background: '#150c28',
          border: '2px solid transparent',
          backgroundImage:
            'linear-gradient(#150c28, #150c28), linear-gradient(135deg, var(--purple), var(--purple-2))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          filter: 'drop-shadow(0 0 10px var(--purple-glow))',
          overflow: 'hidden'
        }}
      >
        {game.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.image_url}
            alt={game.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="26%">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {game.has_badge && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: '6%',
              background: game.badge_color,
              color: getContrastColor(game.badge_color),
              fontFamily: "'Press Start 2P', cursive",
              fontSize: 8,
              padding: '4px 8px',
              maxWidth: '70%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0% 100%)'
            }}
          >
            {game.badge_text}
          </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'rgba(10,7,20,.75)',
            border: '1px solid rgba(255,255,255,.25)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width={15} height={15}>
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 36,
              right: 6,
              background: 'var(--panel-2)',
              border: '1px solid rgba(164,99,255,.4)',
              borderRadius: 10,
              padding: 6,
              zIndex: 5,
              minWidth: 150,
              boxShadow: '0 10px 30px rgba(0,0,0,.5)'
            }}
          >
            <MenuButton
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
            >
              ✎ Editar
            </MenuButton>
            <MenuButton
              onClick={() => {
                setMenuOpen(false);
                onArchive();
              }}
            >
              📦 Arquivar
            </MenuButton>
            <MenuButton
              danger
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              🗑 Excluir
            </MenuButton>
          </div>
        )}
      </div>
      <div style={{ padding: '9px 2px 0', textAlign: 'center' }}>
        <p style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {game.name}
        </p>
        <p style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 12, color: 'var(--green)', textShadow: '0 0 8px var(--green-glow)', margin: 0 }}>
          R$ {parseFloat(game.price).toFixed(2).replace('.', ',')}
        </p>
      </div>
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  danger
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: danger ? '#ff8a8a' : 'var(--ink)',
        textAlign: 'left',
        padding: '9px 10px',
        borderRadius: 6,
        fontFamily: "'Rajdhani',sans-serif",
        fontWeight: 600,
        fontSize: 13.5,
        cursor: 'pointer',
        width: '100%'
      }}
    >
      {children}
    </button>
  );
}

function GameFormPanel({
  game,
  onClose,
  onSaved
}: {
  game: Game | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!game;
  const action = isEditing ? updateGameAction : createGameAction;
  const [state, formAction] = useActionState(action, emptyFormState);
  const [hasBadge, setHasBadge] = useState(game?.has_badge ?? false);
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState<string | null>(game?.image_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // useFormState's `state` is a brand-new object every time the action
    // finishes running, so any change after the initial mount means a
    // submission just completed — skip the mount-time firing, then treat
    // a null error as "saved successfully".
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (state.error === null) {
      onSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.35)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 20
      }}
    >
      <h3 style={{ margin: '0 0 16px', fontFamily: "'Press Start 2P',cursive", fontSize: 13, color: 'var(--purple)' }}>
        {isEditing ? 'EDITAR JOGO' : 'ADICIONAR JOGO'}
      </h3>
      <form action={formAction}>
        {isEditing && <input type="hidden" name="id" value={game!.id} />}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label htmlFor="name">Nome do jogo</label>
            <input id="name" name="name" type="text" defaultValue={game?.name} placeholder="Ex: Fire Emblem Engage" required />
          </div>
          <div>
            <label htmlFor="price">Preço (R$)</label>
            <input
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={game ? parseFloat(game.price).toFixed(2) : ''}
              placeholder="230.00"
              required
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Capa do jogo</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {preview && !removeImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                style={{ width: 64, height: 85, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(164,99,255,.3)' }}
              />
            )}
            <input
              ref={fileInputRef}
              name="image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ color: 'var(--ink-dim)', fontSize: 13 }}
            />
          </div>
          {isEditing && game?.image_url && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="removeImage"
                name="removeImage"
                type="checkbox"
                checked={removeImage}
                onChange={(e) => setRemoveImage(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--green)' }}
              />
              <label htmlFor="removeImage" style={{ margin: 0, textTransform: 'none', fontSize: 13, color: 'var(--ink)' }}>
                Remover a imagem atual
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <input
            id="hasBadge"
            name="hasBadge"
            type="checkbox"
            checked={hasBadge}
            onChange={(e) => setHasBadge(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
          />
          <label htmlFor="hasBadge" style={{ margin: 0, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
            Adicionar etiqueta
          </label>
        </div>

        {hasBadge && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label htmlFor="badgeText">Texto da etiqueta</label>
              <input id="badgeText" name="badgeText" type="text" maxLength={14} defaultValue={game?.badge_text || 'TOP'} />
            </div>
            <div>
              <label htmlFor="badgeColor">Cor da etiqueta</label>
              <input id="badgeColor" name="badgeColor" type="color" defaultValue={game?.badge_color || '#4ef05f'} />
            </div>
          </div>
        )}

        {state.error && (
          <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '0 0 14px' }}>{state.error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <SubmitButton isEditing={isEditing} />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" disabled={pending}>
      {pending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar'}
    </button>
  );
}
