'use client';

import { useMemo, useState } from 'react';
import { getContrastColor } from '@/lib/color';

type Item = {
  id: number;
  name: string;
  priceLabel: string;
  originalPriceLabel: string | null;
  imageUrl: string | null;
  hasBadge: boolean;
  badgeText: string;
  badgeColor: string;
  whatsappUrl: string;
};

export default function CatalogClient({ items }: { items: Item[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>
      <header style={{ marginBottom: 22 }}>
        <div className="brand">
          XAN<span>SWITCH</span>
        </div>
        <p style={{ color: 'var(--ink-dim)', fontSize: 14.5, fontWeight: 600, margin: '6px 0 0' }}>
          Clique no jogo que você quer e a conversa já abre no WhatsApp, prontinha pra fechar o
          pedido.
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--panel)',
          border: '1px solid rgba(164,99,255,.3)',
          borderRadius: 10,
          padding: '10px 14px',
          marginBottom: 22,
          maxWidth: 420
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

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-dim)' }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            {items.length === 0
              ? 'Nenhum jogo disponível no momento. Volte em breve!'
              : 'Nenhum jogo encontrado com esse nome.'}
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
          {filtered.map((item) => (
            <GameCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <p
        style={{
          textAlign: 'center',
          color: 'var(--ink-dim)',
          fontSize: 12.5,
          fontWeight: 600,
          marginTop: 50
        }}
      >
        XAN SWITCH — Nintendo mais barato
      </p>
    </div>
  );
}

function GameCard({ item }: { item: Item }) {
  return (
    <a
      href={item.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
    >
      <div className="cover-frame">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-dim)'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="26%">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {item.hasBadge && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: '6%',
              background: item.badgeColor,
              color: getContrastColor(item.badgeColor),
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
            {item.badgeText}
          </div>
        )}
      </div>
      <div style={{ padding: '9px 2px 0', textAlign: 'center' }}>
        <p
          style={{
            fontWeight: 700,
            fontSize: 13.5,
            color: 'var(--ink)',
            margin: '0 0 3px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {item.name}
        </p>
        {item.originalPriceLabel && (
          <p
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: '#8b83a8',
              textDecoration: 'line-through',
              margin: '0 0 2px'
            }}
          >
            R$ {item.originalPriceLabel}
          </p>
        )}
        <p
          style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: 12,
            color: 'var(--green)',
            textShadow: '0 0 8px var(--green-glow)',
            margin: 0
          }}
        >
          R$ {item.priceLabel}
        </p>
      </div>
    </a>
  );
}
