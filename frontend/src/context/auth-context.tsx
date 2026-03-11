'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { setAuthToken, clearAuthToken, authPost, authGet } from '@/lib/simple-api-client';

type User = {
  uid: string;
  email: string;
  displayName: string;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'unmai_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    setAuthToken(token);
    authGet<{ uid: string; email: string; displayName: string }>('/api/user/profile')
      .then((profile) => {
        setUser({ uid: profile.uid, email: profile.email, displayName: profile.displayName });
      })
      .catch(() => {
        // Token invalid/expired — clean up
        localStorage.removeItem(TOKEN_KEY);
        clearAuthToken();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authPost<{ token: string; user: User }>('/api/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, result.token);
    setAuthToken(result.token);
    setUser(result.user);
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await authPost<{ token: string; user: User }>('/api/auth/signup', { email, password, displayName });
    localStorage.setItem(TOKEN_KEY, result.token);
    setAuthToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authPost('/api/auth/logout', {});
    } catch {
      // Logout may fail if token already expired — that's fine
    }
    localStorage.removeItem(TOKEN_KEY);
    clearAuthToken();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
  }), [user, isLoading, login, signup, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
