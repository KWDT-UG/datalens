import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from './AuthContext';
import { hasAnyCapability } from './permissions';

type CapabilityRouteProps = {
  anyOf: string[];
};

export function CapabilityRoute({ anyOf }: CapabilityRouteProps) {
  const { user } = useAuth();

  if (!hasAnyCapability(user, anyOf)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
