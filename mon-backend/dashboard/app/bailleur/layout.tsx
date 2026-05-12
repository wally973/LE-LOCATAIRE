import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BAILLEUR_MENU } from "@/lib/nav/menu-bailleur";
import { RequireRole } from "@/components/auth/require-role";

export default function BailleurSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireRole roles={["BAILLEUR"]}>
      <DashboardShell
        title="Espace gestionnaire"
        breadcrumbs={["Bailleur social"]}
        links={BAILLEUR_MENU}
      >
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
