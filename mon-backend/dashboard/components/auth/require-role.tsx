"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";

/**
 * Limite l’accès à certains rôles métier.
 * `ADMIN` peut accéder à n’importe quelle section configurée avec `allowAdmin`.
 */
export function RequireRole({
  roles,
  allowAdmin = true,
  children,
}: {
  roles: string[];
  allowAdmin?: boolean;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const ok =
      roles.includes(user.role) ||
      (allowAdmin && user.role === "ADMIN");
    if (!ok) {
      router.replace("/login?forbidden=1");
    }
  }, [user, loading, roles, allowAdmin, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Chargement de la session…
      </div>
    );
  }

  const ok =
    roles.includes(user.role) || (allowAdmin && user.role === "ADMIN");
  if (!ok) return null;

  return <>{children}</>;
}
