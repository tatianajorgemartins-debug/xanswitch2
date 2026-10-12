'use client';

// Painel administrativo do catálogo de PRODUTOS FÍSICOS — componente
// separado de app/admin/AdminClient.tsx (jogos digitais) de propósito,
// pra existir uma separação de verdade entre as duas áreas de
// gerenciamento, não só mais uma aba dentro do painel de jogos.
import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import type { PhysicalProduct } from '@/lib/physicalProducts';
import { formatPriceBR } from '@/lib/whatsapp';
import { logoutAction } from '../actions';
import {
  createPhysicalProductAction,
  updatePhysicalProductAction,
  deletePhysicalProductAction,
  setPhysicalProductPublishedAction,
  type PhysicalProductFormState
} from './actions';

const emptyFormState: PhysicalProductFormState = { error: null };

export default function PhysicalProductsAdminClient({ initialProducts }: { initialProducts: PhysicalProduct[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PhysicalProduct | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function openAddPanel() {
    setEditingProduct(null);
    setPanelOpen(true);
  }
  function openEditPanel(product: PhysicalProduct) {
    setEditingProduct(product);
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
    setEditingProduct(null);
  }

  async function handleTogglePublished(product: PhysicalProduct) {
    setTogglingId(product.id);
    await setPhysicalProductPublishedAction(product.id, !product.published);
    setTogglingId(null);
    router.refresh();
  }

  async function handleDelete(product: PhysicalProduct) {
    if (!confirm(`Excluir "${product.name}" do catálogo de produtos físicos? Essa ação não pode ser desfeita.`)) return;
    setDeletingId(product.id);
    await deletePhysicalProductAction(product.id);
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setDeletingId(null);
    router.refresh();
  }

  const demoCount = products.filter((p) => p.is_demo).length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div className="brand">
          XAN<span>SWITCH</span>
        </div>
        <p style={{ color: 'var(--ink-dim)', fontSize: 14.5, fontWeight: 600, margin: 0, flex: 1 }}>
          📦 Produtos físicos — catálogo separado dos jogos digitais, pra sua parceria com a importadora.
        </p>
        <a href="/admin" className="btn ghost">
          🎮 Jogos digitais
        </a>
        <a href="/produtos-fisicos" target="_blank" rel="noreferrer" className="btn ghost">
          🔗 Ver catálogo público
        </a>
        <form action={logoutAction}>
          <button type="submit" className="btn ghost">
            Sair
          </button>
        </form>
      </div>

      {demoCount > 0 && (
        <div
          style={{
            background: 'rgba(255,210,78,.1)',
            border: '1px solid rgba(255,210,78,.35)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--ink)',
            lineHeight: 1.5
          }}
        >
          🏷️ {demoCount} {demoCount === 1 ? 'produto de demonstração' : 'produtos de demonstração'} nessa lista
          (marcado com o selo "DEMO" abaixo) — são só placeholders pra testar o layout. Exclua cada um quando
          tiver os produtos de verdade da importadora pra cadastrar no lugar.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button type="button" className="btn primary" onClick={openAddPanel}>
          ＋ Adicionar produto
        </button>
      </div>

      {panelOpen && (
        <ProductFormPanel product={editingProduct} onClose={closePanel} onSaved={() => { closePanel(); router.refresh(); }} />
      )}

      {products.length === 0 ? (
        <p style={{ color: 'var(--ink-dim)', fontSize: 14, padding: '20px 4px' }}>
          Nenhum produto físico cadastrado ainda. Clique em "＋ Adicionar produto" pra começar.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {products.map((product) => (
            <div
              key={product.id}
              className="admin-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: 'var(--panel)',
                border: '1px solid rgba(164,99,255,.25)',
                borderRadius: 12,
                padding: 12,
                flexWrap: 'wrap'
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'var(--bg-dark)',
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>sem foto</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <strong style={{ fontSize: 14.5, display: 'block', color: 'var(--ink)' }}>{product.name}</strong>
                <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>R$ {formatPriceBR(product.price)}</span>
                {product.original_price && parseFloat(product.original_price) > parseFloat(product.price) && (
                  <span style={{ fontSize: 12, color: '#8b83a8', textDecoration: 'line-through', marginLeft: 8 }}>
                    R$ {formatPriceBR(product.original_price)}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flex: 'none', alignItems: 'center', flexWrap: 'wrap' }}>
                {product.is_demo && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#2b1a00',
                      background: 'linear-gradient(135deg, var(--gold), var(--gold-2))',
                      borderRadius: 6,
                      padding: '3px 8px'
                    }}
                  >
                    DEMO
                  </span>
                )}
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: product.published ? 'var(--green)' : 'var(--ink-dim)',
                    border: `1px solid ${product.published ? 'rgba(78,240,95,.4)' : 'rgba(255,255,255,.2)'}`,
                    borderRadius: 6,
                    padding: '3px 8px'
                  }}
                >
                  {product.published ? 'Publicado' : 'Não publicado'}
                </span>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ padding: '5px 10px', fontSize: 12.5 }}
                  disabled={togglingId === product.id}
                  onClick={() => handleTogglePublished(product)}
                >
                  {togglingId === product.id ? '...' : product.published ? 'Despublicar' : 'Publicar'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ padding: '5px 10px', fontSize: 12.5 }}
                  onClick={() => openEditPanel(product)}
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ padding: '5px 10px', fontSize: 12.5 }}
                  disabled={deletingId === product.id}
                  onClick={() => handleDelete(product)}
                >
                  {deletingId === product.id ? 'Excluindo...' : '🗑 Excluir'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" disabled={pending}>
      {pending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar produto'}
    </button>
  );
}

function ProductFormPanel({
  product,
  onClose,
  onSaved
}: {
  product: PhysicalProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!product;
  const action = isEditing ? updatePhysicalProductAction : createPhysicalProductAction;
  const [state, formAction] = useActionState(action, emptyFormState);
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // useActionState mantém a mesma referência de emptyFormState até uma
  // submissão de verdade terminar — então "mudou de referência e não tem
  // erro" é sinal confiável de sucesso, sem precisar de uma flag à parte
  // (mesmo padrão de GameFormPanel em AdminClient.tsx).
  useEffect(() => {
    if (state === emptyFormState) return;
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

  function handleRemoveImage() {
    setRemoveImage(true);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div
      className="admin-panel"
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.3)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 20
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--ink)' }}>
          {isEditing ? `Editar "${product.name}"` : 'Novo produto físico'}
        </h3>
        <button type="button" className="btn ghost" onClick={onClose}>
          ✕ Fechar
        </button>
      </div>

      <form action={formAction}>
        {isEditing && <input type="hidden" name="id" value={product.id} />}

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="pp-name">Nome do produto</label>
          <input id="pp-name" name="name" type="text" required defaultValue={product?.name ?? ''} placeholder="Ex: Controle sem fio para Nintendo Switch" />
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="pp-price">Preço (R$)</label>
            <input
              id="pp-price"
              name="price"
              type="text"
              inputMode="decimal"
              required
              defaultValue={product?.price ? parseFloat(product.price).toFixed(2) : ''}
              placeholder="Ex: 149.90"
            />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="pp-original-price">Preço original (opcional)</label>
            <input
              id="pp-original-price"
              name="originalPrice"
              type="text"
              inputMode="decimal"
              defaultValue={product?.original_price ? parseFloat(product.original_price).toFixed(2) : ''}
              placeholder="Ex: 199.90"
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="pp-description">Descrição (opcional)</label>
          <textarea
            id="pp-description"
            name="description"
            rows={3}
            defaultValue={product?.description ?? ''}
            placeholder="Detalhes do produto, compatibilidade, cor, etc."
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Foto do produto</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(164,99,255,.3)' }}
              />
            )}
            <input ref={fileInputRef} name="image" type="file" accept="image/*" onChange={handleFileChange} />
            {preview && (
              <button type="button" className="btn ghost" onClick={handleRemoveImage} style={{ padding: '5px 10px', fontSize: 12.5 }}>
                Remover foto
              </button>
            )}
          </div>
          {removeImage && <input type="hidden" name="removeImage" value="on" />}
          <p style={{ margin: '6px 2px 0', fontSize: 12.5, color: 'var(--ink-dim)' }}>
            Se não enviar nenhuma foto, o card mostra um ícone de imagem no lugar — nunca depende de um link
            externo que possa quebrar.
          </p>
        </div>

        <div style={{ marginBottom: 18, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="pp-published"
              name="published"
              type="checkbox"
              defaultChecked={product?.published ?? true}
              style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
            />
            <label htmlFor="pp-published" style={{ margin: 0, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
              Publicado (visível no catálogo público)
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="pp-is-demo"
              name="isDemo"
              type="checkbox"
              defaultChecked={product?.is_demo ?? false}
              style={{ width: 18, height: 18, accentColor: 'var(--gold)' }}
            />
            <label htmlFor="pp-is-demo" style={{ margin: 0, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
              Produto de demonstração (placeholder)
            </label>
          </div>
        </div>

        {state.error && <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{state.error}</p>}

        <div className="purchase-modal-actions" style={{ justifyContent: 'flex-start' }}>
          <SubmitButton isEditing={isEditing} />
          <button type="button" className="purchase-step-back" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
