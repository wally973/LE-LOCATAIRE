import type { ReactNode } from "react";
import type { SidebarLink } from "@/components/layout/app-sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

export function DashboardShell({
  title,
  breadcrumbs,
  links,
  children,
}: {
  title: string;
  breadcrumbs: string[];
  links: SidebarLink[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppSidebar title={title} links={links} />
      <div className="flex flex-1 flex-col">
        <AppTopbar breadcrumbs={breadcrumbs} />
        <main className="flex-1 bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
