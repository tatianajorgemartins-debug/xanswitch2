import { Archivo } from 'next/font/google';
import { DesignVariantProvider, type DesignVariant } from './DesignVariant';
import { ThemeProvider, THEME_INIT_SCRIPT } from './Theme';
import { PageLoader } from './XanLoader';
import SiteMotion from './SiteMotion';
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
// teste (app/admin/teste), pra comparar. themeToggle liga o botão de modo
// claro/escuro. testPreview marca a página de teste (.is-test-preview), pra
// experimentar mudanças de CSS só lá antes de levar pro site. A tela de
// carregamento (PageLoader) cobre a página até ela terminar de carregar.
export default function SiteShell({
  variant = 'redesign',
  themeToggle = true,
  testPreview = false,
  children
}: {
  variant?: DesignVariant;
  themeToggle?: boolean;
  testPreview?: boolean;
  children: React.ReactNode;
}) {
  if (variant !== 'redesign') {
    return <DesignVariantProvider variant={variant}>{children}</DesignVariantProvider>;
  }

  const shell = (
    <div className={`redesign ${archivo.variable}${themeToggle ? ' theme-enabled' : ''}${testPreview ? ' is-test-preview' : ''}`}>
      {/* Sem JavaScript a tela de carregamento nunca sumiria — então nem aparece. */}
      <noscript dangerouslySetInnerHTML={{ __html: '<style>.xan-loader{display:none!important}</style>' }} />
      <PageLoader />
      <SiteMotion />
      {children}
    </div>
  );

  return (
    <DesignVariantProvider variant={variant}>
      {themeToggle ? (
        <>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
          <ThemeProvider>{shell}</ThemeProvider>
        </>
      ) : (
        shell
      )}
    </DesignVariantProvider>
  );
}
