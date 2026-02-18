"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/login?redirect=${pathname}`);
      return;
    }

    if (requireAdmin && user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [user, loading, requireAdmin, router, pathname]);

  if (loading) return null;

  if (!user) return null;

  return <>{children}</>;
}
