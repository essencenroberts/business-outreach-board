import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "../lib/api";

interface AuthState {
  email: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setEmail(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) {
      setReady(true);
      return;
    }
    api
      .get<{ email: string }>("/auth/me")
      .then((me) => setEmail(me.email))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (loginEmail: string, password: string) => {
    const res = await api.post<{ token: string; email: string }>("/auth/login", { email: loginEmail, password });
    setToken(res.token);
    setEmail(res.email);
  }, []);

  return <AuthContext.Provider value={{ email, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
