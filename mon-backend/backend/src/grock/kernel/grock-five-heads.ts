/**
 * Les 5 TÊTES du noyau Grock (Couche 2) — structure GÉNÉRIQUE.
 *
 * Métaphore fondatrice : une IA seule est un chien à une tête (mono-flux).
 * En entrant dans Grock, elle devient une créature à 5 têtes : le noyau
 * décompose et canalise son raisonnement. Aucune connaissance métier ici —
 * le savoir est fourni par le PACK MÉTIER (Couche 3).
 */

export interface GrockHead {
  /** Rang de la tête dans l'ordre de raisonnement (1 → 5). */
  readonly n: number;
  /** Nom de la tête. */
  readonly name: string;
  /** Consignes de la tête (injectées dans le prompt maître). */
  readonly mission: readonly string[];
}

export const GROCK_FIVE_HEADS: readonly GrockHead[] = [
  {
    n: 1,
    name: 'ANALYSE',
    mission: [
      'Tu extrais les faits visibles, les symptômes, les indices.',
      'Tu identifies ce qui est certain, probable, flou.',
      'Tu ne déduis rien à cette étape.',
    ],
  },
  {
    n: 2,
    name: 'VÉRIFICATION DE RÉALITÉ',
    mission: [
      'Tu compares les faits entre eux et tu les croises avec l’image réelle si elle existe.',
      'Tu détectes les contradictions, incohérences, zones d’incertitude.',
      'Tu n’inventes jamais un fait non observé ; tu identifies ce qui doit être clarifié.',
    ],
  },
  {
    n: 3,
    name: 'DÉDUCTION',
    mission: [
      'Tu déduis la cause probable à partir de la physique, de la logique et du savoir métier fourni plus bas.',
      'Tu restes cohérent avec les faits observés : rien qui dépasse la preuve.',
    ],
  },
  {
    n: 4,
    name: 'DÉCISION',
    mission: [
      'Si l’incertitude bloque la conclusion, tu poses UNE seule question, la plus utile, celle qui réduit l’incertitude (jamais plusieurs).',
      'Sinon tu tranches la responsabilité — bailleur / locataire / tiers / sinistre — selon les règles métier fournies, et tu expliques toujours pourquoi.',
    ],
  },
  {
    n: 5,
    name: 'RÉSOLUTION',
    mission: [
      'Tu produis le message final au locataire, dans cet ordre utile :',
      'la consigne de sécurité en premier si un danger existe,',
      'la consigne utile à faire maintenant,',
      'la preuve à fournir (photo) quand elle aide à trancher,',
      'l’orientation vers bailleur / locataire / technicien,',
      'un résumé simple de la loi si nécessaire.',
      'Tu restes simple, clair, direct.',
    ],
  },
];

/** Rend la section « 5 têtes » du prompt maître à partir de la structure typée. */
export function renderGrockFiveHeads(): string {
  const lines = [
    '🟧 STRUCTURE COGNITIVE — 5 TÊTES INTERNES',
    'Tu raisonnes toujours dans cet ordre :',
  ];
  for (const head of GROCK_FIVE_HEADS) {
    lines.push('', `${head.n}. ${head.name}`, ...head.mission);
  }
  return lines.join('\n');
}
