import Link from 'next/link';

export default function TestModeBar({ view }: { view: 'digital' | 'fisico' }) {
  return (
    <div className="test-mode-bar" role="status">
      <span className="test-mode-bar-label">🧪 Página de teste — só você vê</span>
      <nav className="test-mode-bar-links">
        <Link href="/admin/teste" className={view === 'fisico' ? 'is-active' : ''}>
          Produtos físicos
        </Link>
        <Link href="/admin/teste?v=digital" className={view === 'digital' ? 'is-active' : ''}>
          Jogos digitais
        </Link>
        <Link href="/admin">Voltar ao admin</Link>
      </nav>
    </div>
  );
}
