import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeControl() {
  const { theme, palette, setPalette, toggleTheme } = useTheme();
  return (
    <>
      <button onClick={toggleTheme}>{theme}</button>
      <button onClick={() => setPalette('lake')}>{palette}</button>
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-palette');
    document.documentElement.style.removeProperty('color-scheme');
    window.localStorage.setItem('kwdt-theme', 'light');
    window.localStorage.removeItem('kwdt-palette');
  });

  it('persists a selected theme and updates the document for offline reloads', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: 'light' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('kwdt-theme')).toBe('dark');

    await user.click(screen.getAllByRole('button')[1]);

    expect(document.documentElement.dataset.palette).toBe('lake');
    expect(window.localStorage.getItem('kwdt-palette')).toBe('lake');
  });

  it('replaces an unsupported saved palette with the KWDT Reference palette', () => {
    window.localStorage.setItem('kwdt-palette', 'retired-palette');

    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>
    );

    expect(document.documentElement.dataset.palette).toBe('sun');
    expect(window.localStorage.getItem('kwdt-palette')).toBe('sun');
  });
});
