"use client";

import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

type User = {
  id: number;
  username: string;
  role: "ADMIN" | "VIEWER";
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let memoryToken: string | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      memoryToken = null;
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memoryToken) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post("/auth/login", { username, password });
    memoryToken = res.data.access_token;
    await fetchUser();
  };

  const logout = () => {
    memoryToken = null;
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function getToken() {
  return memoryToken;
}
