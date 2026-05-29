/**
 * Perspective logement depuis l’inscription — sans demander « immeuble ou villa ? ».
 * Règle porteur : chiffre+lettre (ex. 5F) ≈ bâtiment collectif ; chiffre seul (ex. 26) ≈ plein pied.
 * La lettre peut être bâtiment ou lot selon la résidence — on ne parse pas, on infère le collectif.
 */

export type HousingKind = 'collective' | 'standalone' | 'unknown';

export interface HousingPerspective {
  kind: HousingKind;
  /** Identifiant brut (inscription / ticket) */
  unitLabel: string | null;
  /** Ce que Jarvis visualise en coulisse (console expert) */
  visualNote: string;
}

function norm(raw: string): string {
  return raw.trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Déduit collectif vs plein pied depuis l’identifiant lot. */
export function inferHousingPerspective(unitLabel?: string | null): HousingPerspective {
  const raw = unitLabel?.trim();
  if (!raw) {
    return {
      kind: 'unknown',
      unitLabel: null,
      visualNote:
        'Identifiant logement inconnu — Jarvis peut demander étage ou voisin au-dessus si utile.',
    };
  }

  const compact = norm(raw).replace(/\s+/g, '');
  const hasLetter = /[A-Z]/.test(compact.replace(/^LOG-/, ''));
  const digitsAndLetter = /^\d+[A-Z]$|^[A-Z]\d+$|^\d+[A-Z]\d*$/.test(
    compact.replace(/.*-/, ''),
  );

  if (hasLetter && (digitsAndLetter || /[A-Z]/.test(compact))) {
    return {
      kind: 'collective',
      unitLabel: raw,
      visualNote: `Lot ${raw} — résidence / bâtiment collectif (réseaux partagés possibles).`,
    };
  }

  if (/^\d+$/.test(compact.replace(/.*-/, '')) || /^LOG-\d+-\d+$/.test(compact)) {
    return {
      kind: 'standalone',
      unitLabel: raw,
      visualNote: `Lot ${raw} — logement plein pied / numéro simple (piste locale prioritaire).`,
    };
  }

  return {
    kind: 'unknown',
    unitLabel: raw,
    visualNote: `Lot ${raw} — forme non standard ; pas d’hypothèse forte sur le collectif.`,
  };
}
