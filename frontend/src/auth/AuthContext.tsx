import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  ApiClientError,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  UNAUTHORIZED_EVENT
} from '../api/client';
import { apiGet, apiPost } from '../api/client';
import type { AuthUser, DataEnvelope, LoginResponse } from '../api/types';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(getAuthToken()));

  const clearAuthState = useCallback(() => {
    clearAuthToken();
    setUser(null);
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!getAuthToken()) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    apiGet<DataEnvelope<{ user: AuthUser }>>('/api/v1/auth/me/')
      .then((response) => {
        if (isMounted) {
          setUser(response.data.user);
        }
      })
      .catch(() => {
        clearAuthState();
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [clearAuthState]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiPost<DataEnvelope<LoginResponse>, { username: string; password: string }>(
      '/api/v1/auth/login/',
      { username, password }
    );
    setAuthToken(response.data.token);
    setUser(response.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost<void, Record<string, never>>('/api/v1/auth/logout/', {});
    } catch (error) {
      if (!(error instanceof ApiClientError && error.status === 401)) {
        throw error;
      }
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(getAuthToken()),
      isLoading,
      login,
      logout,
      user
    }),
    [isLoading, login, logout, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
