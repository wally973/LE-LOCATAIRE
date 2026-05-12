import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LOCATAIRE_MENU } from "@/lib/nav/menu-locataire";
import { RequireRole } from "@/components/auth/require-role";

export default function LocataireSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireRole roles={["LOCATAIRE"]}>
      <DashboardShell
        title="Portail locataire"
        breadcrumbs={["Locataire"]}
        links={LOCATAIRE_MENU}
      >
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
