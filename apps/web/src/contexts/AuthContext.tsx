import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@video-cv/types";
import { getToken, setToken, clearToken, getStoredUser, storeUser } from "@/lib/auth";
import { apiClient, syncToken } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getToken();
    const storedUser = getStoredUser();
    if (stored) {
      setTokenState(stored);
      setUser(storedUser);
      syncToken();
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.auth.login({ email, password });
    setToken(res.token);
    storeUser(res.user);
    apiClient.setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await apiClient.auth.register({
      email,
      password,
      privacyPolicyVersion: "1.0",
    });
    setToken(res.token);
    storeUser(res.user);
    apiClient.setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch {
      // best-effort
    }
    clearToken();
    apiClient.setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
