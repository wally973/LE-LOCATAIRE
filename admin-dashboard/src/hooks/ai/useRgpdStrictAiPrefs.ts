const LS_RGPD_STRICT_AI = 'le-locataire:rgpd-strict-ai-mode';

/** Mode strict RGPD activé par défaut (refus automatique si données personnelles détectées). */
export function getRgpdStrictAiMode(): boolean {
  try {
    const v = localStorage.getItem(LS_RGPD_STRICT_AI);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

export function setRgpdStrictAiMode(strict: boolean): void {
  try {
    localStorage.setItem(LS_RGPD_STRICT_AI, strict ? '1' : '0');
    window.dispatchEvent(new Event('le-locataire:rgpd-strict-ai-changed'));
  } catch {
    /* ignore */
  }
}
