import Link from 'next/link';

export default function TestModeBar({ view, design }: { view: 'digital' | 'fisico'; design: 'current' | 'redesign' }) {
  const href = (nextView: 'digital' | 'fisico', nextDesign: 'current' | 'redesign') => {
    const params = new URLSearchParams();
    if (nextView === 'digital') params.set('v', 'digital');
    if (nextDesign === 'current') params.set('d', 'atual');
    const query = params.toString();
    return query ? `/admin/teste?${query}` : '/admin/teste';
  };

  return (
    <div className="test-mode-bar" role="status">
      <span className="test-mode-bar-label">
        🧪 <span className="test-mode-bar-label-long">Página de teste — só você vê</span>
      </span>
      <nav className="test-mode-bar-links" aria-label="Opções da página de teste">
        <Link href={href('fisico', design)} className={view === 'fisico' ? 'is-active' : ''}>
          Físicos
        </Link>
        <Link href={href('digital', design)} className={view === 'digital' ? 'is-active' : ''}>
          Digitais
        </Link>
      </nav>
      <nav className="test-mode-bar-links" aria-label="Visual">
        <Link href={href(view, 'redesign')} className={design === 'redesign' ? 'is-active' : ''}>
          Visual novo
        </Link>
        <Link href={href(view, 'current')} className={design === 'current' ? 'is-active' : ''}>
          Visual atual
        </Link>
      </nav>
      <Link href="/admin" className="test-mode-bar-exit">
        Sair
      </Link>
    </div>
  );
}
