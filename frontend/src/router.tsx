import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { CommunityDetailPage } from './pages/CommunityDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImpactPage } from './pages/ImpactPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ResourcesPage } from './pages/ResourcesPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'communities', element: <CommunitiesPage /> },
          { path: 'communities/:communityId', element: <CommunityDetailPage /> },
          {
            path: 'communities/:communityId/:section',
            element: <CommunityDetailPage />
          },
          { path: 'resources', element: <ResourcesPage /> },
          { path: 'impact', element: <ImpactPage /> },
          { path: 'approvals', element: <ApprovalsPage /> },
          { path: 'reports', element: <PlaceholderPage title="Reports" /> },
          { path: 'donors', element: <PlaceholderPage title="Donors" /> },
          { path: 'profile', element: <PlaceholderPage title="Profile" /> },
          { path: 'admin', element: <PlaceholderPage title="Admin" /> }
        ]
      }
    ]
  }
]);
