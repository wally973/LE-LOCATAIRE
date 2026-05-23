/**
 * Messages locataire après diagnostic — explique pourquoi la charge est LOCATAIRE.
 */

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Évier bouché alors que le lavabo est OK (réponses intake ou texte libre). */
export function isSinkBlockageScenario(text: string): boolean {
  const t = normalizeText(text);
  if (!t.includes('evier')) return false;

  const lavaboOk =
    /lavabo.*(bien|normalement|correct)/.test(t) ||
    /coule bien.*lavabo/.test(t) ||
    /dans le lavabo.*(bien|normalement)/.test(t);

  const evierBlocked =
    /evier.*(pas|mal|non|difficile|lent|bouche|encrasse)/.test(t) ||
    /pas bien.*evier/.test(t) ||
    /pas.*dans l.?evier/.test(t) ||
    (/lavabo/.test(t) && /evier/.test(t) && /pas/.test(t));

  return lavaboOk && evierBlocked;
}

function isUnderFixturePlumbing(text: string): boolean {
  const t = normalizeText(text);
  const keywords = [
    'evier',
    'levier',
    'siphon',
    'robinet',
    'flexible',
    'lavabo',
    'fuite sous',
  ];
  const collective = [
    'colonne',
    'parties communes',
    'canalisation encastr',
    'reseau collectif',
    'mur porteur',
  ];
  return (
    keywords.some((k) => t.includes(k)) && !collective.some((k) => t.includes(k))
  );
}

const ARTISAN_CTA =
  'Utilisez les boutons Oui / Non ci-dessous pour une mise en relation avec un plombier partenaire (devis), ou continuez sans artisan.';

/** Message clair pour charge locataire (plomberie évier / bouchon). */
export function buildLocataireChargeMessage(params: {
  category: string;
  contextText: string;
}): string {
  const { category, contextText } = params;

  if (category === 'PLUMBING' && isSinkBlockageScenario(contextText)) {
    return (
      'Diagnostic : l’eau s’écoule normalement au lavabo, mais pas à l’évier. ' +
      'Le problème est donc localisé à l’évier (siphon, bonde ou canalisation sous l’évier), ' +
      'souvent un bouchon ou un encrassement — pas une canalisation collective du bailleur.\n\n' +
      'Pourquoi à votre charge ? Ce type d’entretien relève des menues réparations / entretien locatif ' +
      '(décret 87-712) : c’est à vous de faire déboucher ou faire intervenir un plombier à vos frais, ' +
      'comme pour un entretien courant de votre logement.\n\n' +
      'Ce n’est pas une intervention que le bailleur doit prendre en charge tant que le lavabo et le réseau général fonctionnent.\n\n' +
      ARTISAN_CTA
    );
  }

  if (category === 'PLUMBING' && isUnderFixturePlumbing(contextText)) {
    return (
      'Diagnostic : le problème concerne l’évier, le lavabo ou la robinetterie sous votre équipement ' +
      '(siphon, flexible, fuite localisée), pas une canalisation collective du logement.\n\n' +
      'Pourquoi à votre charge ? L’entretien courant et les menues réparations sous l’évier ' +
      'sont à la charge du locataire (décret 87-712). Vous pouvez faire intervenir un plombier à vos frais.\n\n' +
      ARTISAN_CTA
    );
  }

  return (
    'Diagnostic : ce type d’intervention relève de l’entretien locatif (à votre charge), pas du bailleur.\n\n' +
    'Vous pouvez faire intervenir un artisan à vos frais si nécessaire. ' +
    ARTISAN_CTA
  );
}
