"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  mfa_enabled: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, login: () => {}, logout: () => {}, loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("eazyai_token");
    const u = localStorage.getItem("eazyai_user");
    if (t && u) {
      setToken(t);
      setUser(JSON.parse(u));
      // Re-set the cookie so it can't expire out from under localStorage
      // (which caused protected pages like /explore to bounce to /login).
      document.cookie = `eazyai_token=${t}; path=/; max-age=${60 * 60 * 24 * 7}`;
    }
    setLoading(false);
  }, []);

  function login(newToken: string, newUser: AuthUser) {
    localStorage.setItem("eazyai_token", newToken);
    localStorage.setItem("eazyai_user", JSON.stringify(newUser));
    document.cookie = `eazyai_token=${newToken}; path=/; max-age=${60 * 60 * 24 * 7}`;
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem("eazyai_token");
    localStorage.removeItem("eazyai_user");
    document.cookie = "eazyai_token=; path=/; max-age=0";
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, token, login, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
