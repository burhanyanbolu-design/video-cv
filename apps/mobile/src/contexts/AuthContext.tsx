import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import type { User } from "@video-cv/types";
import { apiClient } from "../lib/api";

const TOKEN_KEY = "video_cv_token";

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
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((stored) => {
        if (stored) {
          setToken(stored);
          apiClient.setToken(stored);
          // We don't have a /me endpoint, so we just mark as authenticated
          // The user object will be populated on next login
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await apiClient.auth.login({ email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    apiClient.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function register(email: string, password: string) {
    const res = await apiClient.auth.register({
      email,
      password,
      privacyPolicyVersion: "1.0",
    });
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    apiClient.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    try {
      await apiClient.auth.logout();
    } catch {
      // ignore server errors on logout
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    apiClient.setToken(null);
    setToken(null);
    setUser(null);
  }

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
