"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export function AppTopbar({
  breadcrumbs,
}: {
  breadcrumbs: string[];
}) {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Socle HLM
        </Link>
        <span>/</span>
        {breadcrumbs.join(" / ")}
      </div>
      <div className="flex items-center gap-2">
        {user ? (
          <>
            <Badge variant="secondary">{user.role}</Badge>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Déconnexion
            </Button>
          </>
        ) : (
          <Link href="/login">
            <Button variant="outline" size="sm">
              Connexion
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
