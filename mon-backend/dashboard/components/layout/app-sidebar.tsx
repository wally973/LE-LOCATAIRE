"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export type SidebarLink = { href: string; label: string };

export function AppSidebar({
  title,
  links,
}: {
  title: string;
  links: SidebarLink[];
}) {
  const pathname = usePathname();
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/40">
      <div className="flex h-14 items-center px-6 font-semibold">{title}</div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
              pathname === l.href || pathname.startsWith(l.href + "/")
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground",
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
