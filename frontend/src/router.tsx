import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from './auth/ProtectedRoute';
import { CapabilityRoute } from './auth/CapabilityRoute';
import { capabilities } from './auth/permissions';
import { AppShell } from './components/AppShell';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AdminPage } from './pages/AdminPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { CommunityDetailPage } from './pages/CommunityDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImpactPage } from './pages/ImpactPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SearchPage } from './pages/SearchPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/accept-invite', element: <AcceptInvitationPage /> },
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
          {
            path: 'communities/:communityId/:section/:recordId',
            element: <CommunityDetailPage />
          },
          { path: 'resources', element: <ResourcesPage /> },
          { path: 'impact', element: <ImpactPage /> },
          { path: 'search', element: <SearchPage /> },
          {
            element: (
              <CapabilityRoute
                anyOf={[
                  capabilities.reviewApprovals,
                  capabilities.reviewImpactApprovals,
                  capabilities.reviewFinanceApprovals
                ]}
              />
            ),
            children: [{ path: 'approvals', element: <ApprovalsPage /> }]
          },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          {
            element: <CapabilityRoute anyOf={[capabilities.manageUsers]} />,
            children: [{ path: 'admin', element: <AdminPage /> }]
          }
        ]
      }
    ]
  }
]);
