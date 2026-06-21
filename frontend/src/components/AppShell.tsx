import {
  BellIcon,
  ClipboardListIcon,
  CogIcon,
  OutlinedArrowAltCircleRightIcon,
  CubesIcon,
  HomeIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  TableIcon,
  UserCircleIcon,
  UsersIcon
} from '@patternfly/react-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import {
  canReviewApprovals,
  capabilities,
  hasCapability
} from '../auth/permissions';
import { SyncCenter } from '../offline/SyncCenter';
import { useTheme } from '../theme/ThemeProvider';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: HomeIcon },
  { label: 'Communities', to: '/communities', icon: UsersIcon },
  { label: 'Resources', to: '/resources', icon: CubesIcon },
  { label: 'Impact', to: '/impact', icon: TableIcon },
  { label: 'Approvals', to: '/approvals', icon: BellIcon, show: canReviewApprovals },
  { label: 'Reports', to: '/reports', icon: ClipboardListIcon },
  {
    label: 'Admin',
    to: '/admin',
    icon: CogIcon,
    show: (user: ReturnType<typeof useAuth>['user']) =>
      hasCapability(user, capabilities.manageUsers)
  }
];

const paletteOptions = [
  { value: 'sun', label: 'KWDT Reference', description: 'Stone, taupe, and focused orange' },
  { value: 'lake', label: 'Lake & Sun', description: 'Lake teal with warm highlights' }
] as const;

export function AppShell() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, palette, setPalette, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === '/search') {
      setSearch(new URLSearchParams(location.search).get('q') ?? '');
    }
  }, [location.pathname, location.search]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  }

  async function handleLogout() {
    setAccountOpen(false);
    await auth.logout();
    queryClient.clear();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar__brand">
          <img src="/kwdt-logo.webp" alt="Katosi Women Development Trust" />
        </div>
        <nav className="sidebar__nav">
          {navItems.filter((item) => !item.show || item.show(auth.user)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className="sidebar__link">
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <form className="global-search" role="search" onSubmit={handleSearch}>
            <SearchIcon aria-hidden="true" />
            <input
              type="search"
              value={search}
              placeholder="Search communities, people, and resources"
              aria-label="Global search"
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>
          <div className="topbar__user">
            <SyncCenter />
            <div className="theme-picker">
              <button
                className="icon-button theme-toggle"
                type="button"
                onClick={() => setAppearanceOpen((isOpen) => !isOpen)}
                aria-expanded={appearanceOpen}
                aria-label="Choose appearance"
                title="Choose appearance"
              >
                {theme === 'dark' ? <MoonIcon aria-hidden="true" /> : <SunIcon aria-hidden="true" />}
              </button>
              {appearanceOpen ? (
                <div className="theme-picker__panel" aria-label="Appearance options">
                  <p>Display mode</p>
                  <div className="theme-picker__modes">
                    <button
                      className={theme === 'light' ? 'is-active' : ''}
                      type="button"
                      aria-pressed={theme === 'light'}
                      onClick={() => theme === 'dark' && toggleTheme()}
                    >
                      Light
                    </button>
                    <button
                      className={theme === 'dark' ? 'is-active' : ''}
                      type="button"
                      aria-pressed={theme === 'dark'}
                      onClick={() => theme === 'light' && toggleTheme()}
                    >
                      Dark
                    </button>
                  </div>
                  <p>Colour direction</p>
                  <div className="theme-picker__palettes">
                    {paletteOptions.map((option) => (
                      <button
                        className={`theme-picker__palette theme-picker__palette--${option.value}${
                          palette === option.value ? ' is-active' : ''
                        }`}
                        key={option.value}
                        type="button"
                        aria-pressed={palette === option.value}
                        onClick={() => setPalette(option.value)}
                      >
                        <span aria-hidden="true" />
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="account-menu">
              <button
                className="account-menu__trigger"
                type="button"
                onClick={() => setAccountOpen((isOpen) => !isOpen)}
                aria-expanded={accountOpen}
                aria-label="Open account menu"
                title="Account"
              >
                <UserCircleIcon aria-hidden="true" />
              </button>
              {accountOpen ? (
                <div className="account-menu__panel" aria-label="Account menu">
                  <NavLink to="/profile" onClick={() => setAccountOpen(false)}>
                    <UserCircleIcon aria-hidden="true" />
                    Profile
                  </NavLink>
                  <button type="button" onClick={handleLogout}>
                    <OutlinedArrowAltCircleRightIcon aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="workspace__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
