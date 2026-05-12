const STORAGE_ENABLED = 'locataire_avatar_overlay_enabled';
const STORAGE_PACK_ID = 'locataire_avatar_active_pack_id';

export function getAvatarOverlayEnabled(): boolean {
  const v = localStorage.getItem(STORAGE_ENABLED);
  if (v === null) return true;
  return v === '1';
}

export function setAvatarOverlayEnabled(on: boolean): void {
  localStorage.setItem(STORAGE_ENABLED, on ? '1' : '0');
  window.dispatchEvent(new Event('locataire-avatar-settings-changed'));
}

export function getActiveAvatarPackId(): string | null {
  return localStorage.getItem(STORAGE_PACK_ID);
}

export function setActiveAvatarPackId(id: string | null): void {
  if (id == null) localStorage.removeItem(STORAGE_PACK_ID);
  else localStorage.setItem(STORAGE_PACK_ID, id);
  window.dispatchEvent(new Event('locataire-avatar-settings-changed'));
}
