"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login");
      if (requireAdmin && user?.role !== "ADMIN") {
        router.push("/");
      }
    }
  }, [user, loading, requireAdmin, router]);

  if (loading || !user) return null;

  return <>{children}</>;
}
