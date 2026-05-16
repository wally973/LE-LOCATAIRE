import type { UserRole } from './roles';

/** Alignement rôles JWT backend (Prisma) ↔ routes dashboard. */
export function normalizeRole(raw: string | undefined | null): UserRole | null {
  if (!raw) return null;
  switch (raw) {
    case 'ADMIN':
      return 'ADMIN';
    case 'BAILLEUR':
    case 'LANDLORD':
      return 'LANDLORD';
    case 'LOCATAIRE':
    case 'TENANT':
      return 'TENANT';
    case 'PRESTATAIRE':
    case 'ARTISAN':
      return 'ARTISAN';
    case 'AGENT':
      return 'AGENT';
    default:
      return null;
  }
}
