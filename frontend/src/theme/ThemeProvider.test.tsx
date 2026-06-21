import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeControl() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
    window.localStorage.setItem('kwdt-theme', 'light');
  });

  it('persists a selected theme and updates the document for offline reloads', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button'));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('kwdt-theme')).toBe('dark');
  });
});
