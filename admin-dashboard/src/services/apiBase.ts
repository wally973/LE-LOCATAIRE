/**
 * URL racine du backend (sans slash final).
 * En dev sans variable : chaîne vide → requêtes relatives (`/admin`, `/auth`) via le proxy Vite.
 * En prod : définir `VITE_API_URL` (ex. `https://api.example.com`).
 */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_URL;
  if (typeof v === 'string' && v.trim() !== '') {
    return v.replace(/\/$/, '');
  }
  return '';
}
