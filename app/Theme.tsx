'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// Modo claro / escuro. O tema escolhido fica no atributo data-theme do
// <html> (o script de THEME_INIT_SCRIPT aplica a escolha salva antes da
// primeira pintura, sem piscar) e no localStorage. Por enquanto só a página
// de teste liga isso (ver SiteShell themeToggle); no resto do site o
// contexto é null e o botão nem aparece.
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'xan-theme';

export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}`;

const ThemeContext = createContext<{ theme: Theme; toggle: () => void; setTheme: (theme: Theme) => void } | null>(
  null
);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  function setThemeTo(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }

  const toggle = () => setThemeTo(theme === 'light' ? 'dark' : 'light');

  return <ThemeContext.Provider value={{ theme, toggle, setTheme: setThemeTo }}>{children}</ThemeContext.Provider>;
}

export function useThemeToggle() {
  return useContext(ThemeContext);
}
