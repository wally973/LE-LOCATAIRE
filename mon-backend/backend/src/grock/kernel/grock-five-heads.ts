/**
 * Les 5 TÊTES du noyau Grock (Couche 2) — version industrielle.
 *
 * Aucune connaissance métier ici — le savoir est fourni par le PACK MÉTIER (Couche 3).
 */

export interface GrockHead {
  readonly n: number;
  readonly name: string;
  readonly mission: readonly string[];
}

export const GROCK_FIVE_HEADS: readonly GrockHead[] = [
  {
    n: 1,
    name: 'ANALYSE',
    mission: [
      'Extrais les faits visibles ou décrits.',
      'Identifie ce qui est certain, probable, flou — sans déduire.',
      'Score (0–10) : factExtractionConfidence.',
    ],
  },
  {
    n: 2,
    name: 'VÉRIFICATION',
    mission: [
      'Vérifie la cohérence physique ; croise avec l’image si elle existe.',
      'Évalue le danger réel (gradué, pas binaire).',
      'Scores (0–10) : dangerLevel ; realityCheckConfidence.',
    ],
  },
  {
    n: 3,
    name: 'DÉDUCTION',
    mission: [
      'Déduis la cause probable, la gravité, la responsabilité — rien au-delà de la preuve.',
      'Score (0–10) : inferenceConfidence.',
    ],
  },
  {
    n: 4,
    name: 'DÉCISION',
    mission: [
      'Décide : ticket, escalade, responsabilité, action (champ state).',
      'Si l’incertitude bloque : UNE seule question (ASK_ONE_QUESTION) ou NEED_PHOTO.',
      'Score (0–10) : decisionConfidence — modulé par signalQuality si faible.',
    ],
  },
  {
    n: 5,
    name: 'RÉSOLUTION',
    mission: [
      'Produis la parole adaptée au rôle (champ acknowledgment).',
      'Sécurité proportionnée ; valide les bons gestes ; avance sans répéter le tour précédent.',
      'Score (0–10) : communicationIntensity — bandes alignées sur dangerLevel (0–3→1–3, 4–6→4–6, 7–10→7–10).',
    ],
  },
];

/** Rend la section « 5 têtes » du prompt maître. */
export function renderGrockFiveHeads(): string {
  const lines = ['Tu raisonnes toujours dans cet ordre :'];
  for (const head of GROCK_FIVE_HEADS) {
    lines.push('', `Tête ${head.n} — ${head.name}`, ...head.mission.map((m) => `  ${m}`));
  }
  return lines.join('\n');
}
