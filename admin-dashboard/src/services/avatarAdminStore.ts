/**
 * Persistance locale des packs d’avatar (admin) — versioning jusqu’au branchement API.
 */
const STORAGE_KEY = 'le_locataire_avatar_packs_v1';

export interface AvatarAnimationSet {
  id: string;
  label: string;
  urls: Record<string, string>;
}

export interface AvatarPackVersion {
  semver: string;
  createdAt: string;
  note?: string;
  animations: AvatarAnimationSet[];
}

export interface AvatarPack {
  id: string;
  name: string;
  versions: AvatarPackVersion[];
}

export interface AvatarRegistry {
  packs: AvatarPack[];
  activePackId: string | null;
  activeVersionSemver: string | null;
}

function defaultRegistry(): AvatarRegistry {
  return {
    packs: [],
    activePackId: null,
    activeVersionSemver: null,
  };
}

export function loadAvatarRegistry(): AvatarRegistry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRegistry();
    const parsed = JSON.parse(raw) as AvatarRegistry;
    if (!parsed.packs) return defaultRegistry();
    return parsed;
  } catch {
    return defaultRegistry();
  }
}

export function saveAvatarRegistry(r: AvatarRegistry): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  window.dispatchEvent(new Event('admin-avatar-registry-changed'));
}

export function addAvatarPack(pack: AvatarPack): void {
  const r = loadAvatarRegistry();
  const idx = r.packs.findIndex((p) => p.id === pack.id);
  if (idx >= 0) r.packs[idx] = pack;
  else r.packs.push(pack);
  saveAvatarRegistry(r);
}
