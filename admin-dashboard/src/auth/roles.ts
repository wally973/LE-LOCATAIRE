/** Rôles alignés sur le backend Prisma */
export type UserRole = 'ADMIN' | 'LANDLORD' | 'TENANT' | 'ARTISAN' | 'AGENT';

/** Sous-rôles admin (UI — étendre le JWT backend plus tard) */
export type AdminUiRole = 'SUPER_ADMIN' | 'SUPPORT' | 'ADMIN_STANDARD';

const STORAGE_ADMIN_UI = 'admin_ui_role';

export function getAdminUiRole(): AdminUiRole {
  const v = localStorage.getItem(STORAGE_ADMIN_UI);
  if (
    v === 'SUPER_ADMIN' ||
    v === 'SUPPORT' ||
    v === 'ADMIN_STANDARD'
  ) {
    return v;
  }
  return 'SUPER_ADMIN';
}

export function setAdminUiRole(role: AdminUiRole): void {
  localStorage.setItem(STORAGE_ADMIN_UI, role);
}

/** Permissions fines (mock jusqu’à claims JWT dédiés) */
export function canManageUsers(): boolean {
  return getAdminUiRole() === 'SUPER_ADMIN';
}

export function canAccessAudit(): boolean {
  return (
    getAdminUiRole() === 'SUPER_ADMIN' || getAdminUiRole() === 'ADMIN_STANDARD'
  );
}

export function defaultRouteForRole(role: UserRole | null): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'LANDLORD':
      return '/bailleur/dashboard';
    case 'AGENT':
      return '/agent/reclamations';
    case 'TENANT':
      return '/locataire/dashboard';
    case 'ARTISAN':
      return '/';
    default:
      return '/login';
  }
}
