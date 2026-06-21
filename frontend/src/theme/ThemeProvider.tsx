import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

export type Theme = 'dark' | 'light';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'kwdt-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initialTheme(): Theme {
  const documentTheme = document.documentElement.dataset.theme;
  if (documentTheme === 'dark' || documentTheme === 'light') {
    return documentTheme;
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  return systemTheme();
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#111111' : '#f5f7fb');
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }
  return context;
}
