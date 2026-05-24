/** Intentions locataire (compréhension légère, sans LLM). */

function normalizeIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Le locataire ne peut pas ou ne veut pas envoyer de photo — diagnostic sans image. */
export function isSkipPhotoIntent(text: string): boolean {
  const t = normalizeIntentText(text);
  if (!t.trim()) return false;

  const explicitSkip =
    t.includes('pas de photo') ||
    t.includes('sans photo') ||
    t.includes('continuer sans') ||
    t.includes('impossible de prendre') ||
    t.includes('impossible d envoyer') ||
    t.includes('ne peux pas envoyer') ||
    t.includes('peux pas envoyer') ||
    t.includes('pas possible de prendre') ||
    t.includes('pas possible d envoyer');

  const noCamera =
    (t.includes('camera') || t.includes('appareil photo') || t.includes('photo')) &&
    (t.includes('ne fonctionne pas') ||
      t.includes('ne marche pas') ||
      t.includes('ne marche plus') ||
      t.includes('en panne') ||
      t.includes('casse') ||
      t.includes('cassee') ||
      t.includes('hs') ||
      t.includes('bloque') ||
      t.includes('bloquee') ||
      t.includes('defectueux') ||
      t.includes('defectueuse'));

  const cameraBroken =
    t.includes('camera') &&
    (t.includes('mobile') || t.includes('telephone') || t.includes('portable')) &&
    (t.includes('ne fonctionne') || t.includes('ne marche') || t.includes('panne'));

  const cannotProvide =
    (t.includes('je n ai pas') || t.includes("je n'ai pas")) &&
    (t.includes('photo') || t.includes('camera') || t.includes('appareil'));

  const whatToDo =
    (t.includes('que dois') || t.includes('que faire') || t.includes('comment faire')) &&
    (t.includes('camera') || t.includes('photo') || t.includes('sans photo'));

  return (
    explicitSkip || noCamera || cameraBroken || cannotProvide || whatToDo
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
