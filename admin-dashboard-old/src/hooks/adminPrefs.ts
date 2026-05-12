export const ADMIN_PREFS_KEY = 'le_locataire_admin_prefs';

export type AdminPrefs = {
  pageSize: number;
  theme: 'light' | 'dark';
};

const defaults: AdminPrefs = {
  pageSize: 10,
  theme: 'light',
};

/** Préférences UI persistées (locale). */
export function loadAdminPrefs(): AdminPrefs {
  try {
    const raw = localStorage.getItem(ADMIN_PREFS_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<AdminPrefs>;
    return {
      pageSize:
        typeof parsed.pageSize === 'number' && parsed.pageSize > 0
          ? Math.min(parsed.pageSize, 100)
          : defaults.pageSize,
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return { ...defaults };
  }
}

export function saveAdminPrefs(prefs: AdminPrefs): void {
  localStorage.setItem(ADMIN_PREFS_KEY, JSON.stringify(prefs));
}
