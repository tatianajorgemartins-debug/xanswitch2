'use client';

import { createContext, useContext } from 'react';

// Qual visual os componentes do catálogo devem usar. O site público usa
// sempre 'current'; só a página de teste (app/admin/teste) liga 'redesign',
// pra experimentar o visual novo sem afetar quem visita o site.
export type DesignVariant = 'current' | 'redesign';

const DesignVariantContext = createContext<DesignVariant>('current');

export function DesignVariantProvider({ variant, children }: { variant: DesignVariant; children: React.ReactNode }) {
  return <DesignVariantContext.Provider value={variant}>{children}</DesignVariantContext.Provider>;
}

export function useDesignVariant(): DesignVariant {
  return useContext(DesignVariantContext);
}
