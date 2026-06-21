import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

export type Theme = 'dark' | 'light';
export type Palette = 'sun' | 'lake';

type ThemeContextValue = {
  theme: Theme;
  palette: Palette;
  toggleTheme: () => void;
  setPalette: (palette: Palette) => void;
};

const THEME_STORAGE_KEY = 'kwdt-theme';
const PALETTE_STORAGE_KEY = 'kwdt-palette';
const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeColorByPalette: Record<Palette, Record<Theme, string>> = {
  sun: { dark: '#22201e', light: '#fbfbfa' },
  lake: { dark: '#0e252a', light: '#f3f8f7' }
};

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initialTheme(): Theme {
  const documentTheme = document.documentElement.dataset.theme;
  if (documentTheme === 'dark' || documentTheme === 'light') {
    return documentTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  return systemTheme();
}

function initialPalette(): Palette {
  const documentPalette = document.documentElement.dataset.palette;
  if (documentPalette === 'sun' || documentPalette === 'lake') {
    return documentPalette;
  }

  const storedPalette = window.localStorage.getItem(PALETTE_STORAGE_KEY);
  return storedPalette === 'lake' ? storedPalette : 'sun';
}

function applyAppearance(theme: Theme, palette: Palette) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.palette = palette;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeColorByPalette[palette][theme]);
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [palette, setPalette] = useState<Palette>(initialPalette);

  useEffect(() => {
    applyAppearance(theme, palette);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  }, [palette, theme]);

  const value = useMemo(
    () => ({
      theme,
      palette,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
      setPalette
    }),
    [palette, theme]
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
