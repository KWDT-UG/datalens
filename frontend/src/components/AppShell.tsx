import {
  BellIcon,
  ClipboardListIcon,
  CogIcon,
  OutlinedArrowAltCircleRightIcon,
  CubesIcon,
  HomeIcon,
  SearchIcon,
  TableIcon,
  UserCircleIcon,
  UsersIcon
} from '@patternfly/react-icons';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';

import { useHealthQuery } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import {
  canReviewApprovals,
  capabilities,
  hasCapability
} from '../auth/permissions';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: HomeIcon },
  { label: 'Communities', to: '/communities', icon: UsersIcon },
  { label: 'Resources', to: '/resources', icon: CubesIcon },
  { label: 'Impact', to: '/impact', icon: TableIcon },
  { label: 'Approvals', to: '/approvals', icon: BellIcon, show: canReviewApprovals },
  { label: 'Reports', to: '/reports', icon: ClipboardListIcon },
  { label: 'Donors', to: '/donors', icon: UsersIcon },
  {
    label: 'Admin',
    to: '/admin',
    icon: CogIcon,
    show: (user: ReturnType<typeof useAuth>['user']) =>
      hasCapability(user, capabilities.manageUsers)
  }
];

function ApiStatus() {
  const { data, isError, isLoading } = useHealthQuery();
  const state = isLoading ? 'Checking' : isError ? 'Offline' : data?.status === 'ok' ? 'Online' : 'Unknown';

  return <span className={`api-status api-status--${state.toLowerCase()}`}>{state}</span>;
}

export function AppShell() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const displayName =
    [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') ||
    auth.user?.username ||
    'User';

  async function handleLogout() {
    await auth.logout();
    queryClient.clear();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar__brand">KWDT</div>
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
          <label className="global-search">
            <SearchIcon aria-hidden="true" />
            <input type="search" placeholder="Search" aria-label="Global search" />
          </label>
          <div className="topbar__user">
            <ApiStatus />
            <span>{displayName}</span>
            <NavLink to="/profile" aria-label="Open profile">
              <UserCircleIcon />
            </NavLink>
            <button className="icon-button" type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out">
              <OutlinedArrowAltCircleRightIcon />
            </button>
          </div>
        </header>
        <main className="workspace__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
