import { Archivo } from 'next/font/google';
import { DesignVariantProvider, type DesignVariant } from './DesignVariant';
import './redesign.css';

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-redesign'
});

// Envolve as páginas públicas dos catálogos com o visual atual do site
// (fonte, cores e o CSS de redesign.css, preso dentro de .redesign).
// variant="current" devolve o visual antigo — usado só pela página de
// teste (app/admin/teste), pra comparar.
export default function SiteShell({
  variant = 'redesign',
  children
}: {
  variant?: DesignVariant;
  children: React.ReactNode;
}) {
  return (
    <DesignVariantProvider variant={variant}>
      {variant === 'redesign' ? <div className={`redesign ${archivo.variable}`}>{children}</div> : children}
    </DesignVariantProvider>
  );
}
