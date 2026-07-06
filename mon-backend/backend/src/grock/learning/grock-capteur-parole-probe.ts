/**
 * Sonde — alignement CAPTEURS (raisonnement interne) ↔ PAROLE (acknowledgment).
 *
 * Les « capteurs » ici = note_interne + thinking + perception + état décidé.
 * On vérifie si ce que le moteur a compris / décidé ressort dans le message
 * visible au locataire — sans scénario figé, par thèmes sémantiques transférables.
 */

export interface CapteurParoleInput {
  thinking?: string | null;
  noteInterne?: string | null;
  perception?: string | null;
  state?: string | null;
  tenantMessage?: string | null;
  acknowledgment?: string | null;
}

export interface CapteurParoleReport {
  /** 0–100 : part des thèmes internes actionnables retrouvés dans la parole. */
  coveragePct: number;
  /** Thèmes détectés côté capteurs (interne). */
  internalThemes: string[];
  /** Thèmes internes absents de la parole visible. */
  missingInSpeech: string[];
  /** Thèmes présents dans la parole. */
  presentInSpeech: string[];
  /** Écart critique (état vs parole). */
  stateSpeechGap?: string;
  summary: string;
}

/** Thèmes actionnables pour le locataire — pas des scénarios par pièce. */
const THEME_PATTERNS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: 'assurance_sinistre', label: 'assurance / sinistre / déclaration', re: /assur|sinistre|d[eé]clar/i },
  { id: 'delai_5j', label: 'délai 5 jours ouvrés', re: /5\s*jour|cinq\s*jour|ouvr[eé]/i },
  { id: 'photo', label: 'demande ou usage de photo', re: /photo|image|montr|envoy|prendre une photo/i },
  { id: 'securite', label: 'consigne sécurité', re: /s[eé]cur|danger|coup[eé]|courant|secours|risque/i },
  { id: 'obscurite_lumiere', label: 'obscurité / éclairage', re: /sombre|noir|obscur|lumi[eè]re|allum/i },
  { id: 'eau_fuite', label: 'eau / fuite / infiltration', re: /fuite|eau|infiltr|humide|plafond|goutte/i },
  {
    id: 'origine_superieure',
    label: 'origine au-dessus (voisin ou patrimoine)',
    re: /au[- ]dessus|dessus|étage|etage|logement du dessus|toiture|fa[cç]ade|partie[s]? commune|en dessous de|venant d.?en haut/i,
  },
  {
    id: 'bailleur_patrimoine',
    label: 'bailleur / patrimoine / parties communes',
    re: /bailleur|patrimoine|partie[s]? commune|toiture|fa[cç]ade/i,
  },
  { id: 'voisin', label: 'origine voisine / immeuble', re: /voisin|voisine|dessus|collectif|immeuble|au[- ]dessus/i },
  {
    id: 'prevenir_voisin_dessus',
    label: 'prévenir le voisin du dessus (consigne locataire)',
    re: /pr[eé]venez|pr[eé]venir (votre|le) voisin|contactez (votre )?voisin|parlez[- ]à (votre )?voisin|voisin du dessus pour l['’]alerter/i,
  },
  { id: 'technicien_transmission', label: 'transmission technicien / ticket', re: /technicien|transm|ticket|interven/i },
  { id: 'procedure_locataire', label: 'marche à suivre locataire', re: /proc[eé]dure|d[eé]marche|[eé]tape|doit|devez|pouvez/i },
];

function bundleText(input: CapteurParoleInput): string {
  return [
    input.thinking,
    input.noteInterne,
    input.perception,
    input.state,
    input.tenantMessage,
  ]
    .filter(Boolean)
    .join('\n');
}

function detectThemes(text: string): string[] {
  const found: string[] = [];
  for (const t of THEME_PATTERNS) {
    if (t.re.test(text)) found.push(t.id);
  }
  return found;
}

function themeLabel(id: string): string {
  return THEME_PATTERNS.find((t) => t.id === id)?.label ?? id;
}

/** Attentes minimales parole selon l'état (invariant, pas scénario). */
function expectedSpeechForState(state: string | null | undefined): string[] {
  switch (state) {
    case 'sinistre':
      return ['assurance_sinistre', 'photo', 'securite', 'origine_superieure', 'prevenir_voisin_dessus'];
    case 'NEED_PHOTO':
      return ['photo'];
    case 'SAFETY':
    case 'ACTION_LOCATAIRE':
      return ['securite'];
    case 'READY_TICKET':
    case 'bailleur_responsable':
      return []; // technicien seul ne suffit pas si capteurs disent sinistre
    default:
      return [];
  }
}

export function analyzeCapteurParoleAlignment(
  input: CapteurParoleInput,
): CapteurParoleReport {
  const internal = bundleText({
    thinking: input.thinking,
    noteInterne: input.noteInterne,
    perception: input.perception,
    state: input.state,
    tenantMessage: input.tenantMessage,
  });
  const ack = (input.acknowledgment ?? '').trim();
  const speech = ack;

  const internalThemes = detectThemes(internal);
  const speechThemes = detectThemes(speech);

  // Thèmes internes « actionnables » : présents dans note/thinking/perception
  // et pertinents pour le locataire (exclure technicien seul comme preuve de qualité).
  const actionableInternal = internalThemes.filter(
    (id) => id !== 'technicien_transmission',
  );

  const presentInSpeech = actionableInternal.filter((id) =>
    speechThemes.includes(id),
  );
  const missingInSpeech = actionableInternal.filter(
    (id) => !speechThemes.includes(id),
  );

  const tenantDark =
    /sombre|noir|obscur|trop\s+noir/i.test(input.tenantMessage ?? '') ||
    /sombre|noir|obscur/i.test(input.thinking ?? '');
  if (tenantDark && !speechThemes.includes('obscurite_lumiere')) {
    if (!missingInSpeech.includes('obscurite_lumiere')) {
      missingInSpeech.push('obscurite_lumiere');
    }
    if (!internalThemes.includes('obscurite_lumiere')) {
      internalThemes.push('obscurite_lumiere');
    }
  }

  const tenantCeiling =
    /plafond|infiltr|goutte/i.test(input.tenantMessage ?? '') ||
    /plafond|infiltr/i.test(input.perception ?? '');
  if (input.state === 'sinistre' && tenantCeiling) {
    if (!internalThemes.includes('prevenir_voisin_dessus')) {
      internalThemes.push('prevenir_voisin_dessus');
    }
  }

  const expected = expectedSpeechForState(input.state);
  let stateSpeechGap: string | undefined;
  for (const exp of expected) {
    if (!speechThemes.includes(exp)) {
      stateSpeechGap = `État « ${input.state} » : la parole devrait refléter « ${themeLabel(exp)} ».`;
      if (!missingInSpeech.includes(exp)) missingInSpeech.push(exp);
    }
  }

  // Sinistre en capteurs mais parole = seulement technicien
  if (
    internalThemes.includes('assurance_sinistre') &&
    speechThemes.includes('technicien_transmission') &&
    !speechThemes.includes('assurance_sinistre')
  ) {
    stateSpeechGap =
      'Les capteurs voient un sinistre/assurance, mais la parole ne parle que de technicien.';
    if (!missingInSpeech.includes('assurance_sinistre')) {
      missingInSpeech.push('assurance_sinistre');
    }
  }

  const denom = Math.max(actionableInternal.length, 1);
  const coveragePct = Math.round((presentInSpeech.length / denom) * 100);

  const summary =
    missingInSpeech.length === 0
      ? `Alignement OK (${coveragePct} %) — capteurs reflétés dans la parole.`
      : `Écart capteurs ↔ parole (${coveragePct} %) : manque ${missingInSpeech.map(themeLabel).join(', ')}.`;

  return {
    coveragePct,
    internalThemes: [...new Set(internalThemes)],
    missingInSpeech: [...new Set(missingInSpeech)],
    presentInSpeech: [...new Set(presentInSpeech)],
    stateSpeechGap,
    summary,
  };
}
