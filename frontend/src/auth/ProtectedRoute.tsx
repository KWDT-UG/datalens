import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';
import { capabilities, hasCapability } from './permissions';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    return <div className="auth-loading">Loading workspace...</div>;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasCapability(auth.user, capabilities.read)) {
    return (
      <div className="auth-loading">
        Your account does not have an assigned Data Lens role. Contact a system administrator.
      </div>
    );
  }

  return <Outlet />;
}
