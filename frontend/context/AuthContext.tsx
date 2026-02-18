"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import api from "@/lib/api";
import type { AxiosError } from "axios";

type User = {
  id: number;
  username: string;
  role: "ADMIN" | "VIEWER";
  organization_id?: number;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  showToast: (message: string) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriedRefresh = useRef(false);

  // ===============================
  // Fetch Logged In User
  // ===============================
  const fetchUser = async (): Promise<boolean> => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
      return true;
    } catch {
      setUser(null);
      return false;
    }
  };

  // ===============================
  // Refresh Session
  // ===============================
  const refreshSession = async () => {
    try {
      await api.post("/auth/refresh");
      await fetchUser();
    } catch {
      setUser(null);
    }
  };

  // ===============================
  // Initial Load (Safe + Stable)
  // ===============================
  useEffect(() => {
    const init = async () => {
      const success = await fetchUser();

      // If access token expired, try refresh ONCE
      if (!success && !hasTriedRefresh.current) {
        hasTriedRefresh.current = true;
        try {
          await api.post("/auth/refresh");
          await fetchUser();
        } catch {
          setUser(null);
        }
      }

      setLoading(false);
    };

    init();
  }, []);

  // ===============================
  // Login
  // ===============================
  const login = async (username: string, password: string) => {
    try {
      await api.post("/auth/login", {
        username: username.trim(),
        password: password.trim(),
      });

      await fetchUser();
      showToast("Successfully Logged In");
    } catch (error) {
      const err = error as AxiosError;
      throw err;
    }
  };

  // ===============================
  // Register
  // ===============================
  const register = async (username: string, password: string) => {
    try {
      await api.post("/auth/register", {
        username: username.trim(),
        password: password.trim(),
      });

      await login(username, password);
    } catch (error) {
      const err = error as AxiosError;
      throw err;
    }
  };

  // ===============================
  // Logout
  // ===============================
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  };

  // ===============================
  // Toast System
  // ===============================
  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast(message);

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshSession,
        showToast,
      }}
    >
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="border border-green-500 text-green-500 px-6 py-3 rounded-md bg-black/70 backdrop-blur-md">
            {toast}
          </div>
        </div>
      )}

      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
