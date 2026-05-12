"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthUser } from "@/lib/api/auth-client";
import { authMe, authRefresh } from "@/lib/api/auth-client";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
} from "@/lib/auth/token-storage";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
  setUser: (u: AuthUser | null) => void;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearAuthTokens();
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const access = getAccessToken();
    const refresh = getRefreshToken();

    async function resolveAccessToken(): Promise<string | null> {
      if (access) return access;
      if (!refresh) return null;
      const data = await authRefresh(refresh);
      return data.token ?? data.access_token ?? null;
    }

    try {
      let token = await resolveAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const me = await authMe(token);
        setUser(me);
        setError(null);
      } catch {
        if (!refresh) throw new Error("Session expirée");
        await authRefresh(refresh);
        const t2 = getAccessToken();
        if (!t2) throw new Error("Session expirée");
        const me = await authMe(t2);
        setUser(me);
        setError(null);
      }
    } catch (e: unknown) {
      setUser(null);
      if (e instanceof Error) setError(e.message);
      clearAuthTokens();
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refreshSession();
      setLoading(false);
    })();
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      logout,
      setUser,
      refreshSession,
    }),
    [user, loading, error, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans AuthProvider");
  }
  return ctx;
}
