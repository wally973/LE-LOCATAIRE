import type { SidebarLink } from "@/components/layout/app-sidebar";

export const LOCATAIRE_MENU: SidebarLink[] = [
  { href: "/locataire/dashboard", label: "Dashboard" },
  { href: "/locataire/entretien", label: "Entretien du logement" },
  { href: "/locataire/entretien/historique", label: "Historique preuves" },
  { href: "/locataire/tutoriels", label: "Tutoriels" },
  { href: "/locataire/tickets", label: "Tickets" },
];
