/** Intentions locataire (compréhension légère, sans LLM). */

export function isSkipPhotoIntent(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    t.includes('pas de photo') ||
    t.includes('sans photo') ||
    t.includes('continuer sans') ||
    t.includes('je n’ai pas') ||
    t.includes("je n'ai pas")
  );
}

export function isDeclineArtisanIntent(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t === 'non' || t.startsWith('non,') || t.startsWith('non ')) {
    return /plombier|artisan|électric|electric|serrur|prestataire|intervention/.test(
      t,
    );
  }
  const decline = [
    'pas de plombier',
    'sans plombier',
    'sans artisan',
    'ne souhaite pas',
    'ne veux pas',
    'ne voudrais pas',
    'je refuse',
    'pas besoin de plombier',
    "pas besoin d'artisan",
    'pas besoin d’artisan',
  ];
  return decline.some((k) => t.includes(k));
}

export function isArtisanIntent(text: string): boolean {
  if (isDeclineArtisanIntent(text)) return false;
  const t = text.toLowerCase();
  const keywords = [
    'plombier',
    'électricien',
    'electricien',
    'serrurier',
    'artisan',
    'devis',
    'je voudrais',
    'je veux',
    'je souhaite',
    "j'aimerais",
    'demander un',
    'demande un',
    'intervention',
    'prestataire',
  ];
  return keywords.some((k) => t.includes(k));
}

export function resolveArtisanLabel(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('plombier') || t.includes('fuite')) return 'plombier';
  if (t.includes('électric') || t.includes('electric')) return 'électricien';
  if (t.includes('serrur')) return 'serrurier';
  return 'artisan';
}
