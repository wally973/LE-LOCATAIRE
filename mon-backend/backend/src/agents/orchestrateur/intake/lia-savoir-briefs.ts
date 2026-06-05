/** Briefs Savoir — VISUAL_LOGIC.md et TRADES_CULTURE.md (sans moteur script). */
import * as fs from 'fs';
import * as path from 'path';

const TRADES_CULTURE_FALLBACK = [
  'CULTURE MÉTIER — Forces du bâtiment (résumé) :',
  '• Électricité = force invisible ; grésillement / odeur brûlé = incendie imminent.',
  '• Plomberie = pression amont vs pente aval ; refoulement EU = urgence.',
  '• Menuiserie = pivots, gâche, dilatation humidité.',
  '• Humain = contrainte physique (mobilité, urgence vécue).',
].join('\n');

function readRepoMarkdown(filename: string, maxLen: number): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', filename),
    path.resolve(process.cwd(), filename),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return raw.length > maxLen ? `${raw.slice(0, maxLen)}\n…` : raw;
      }
    } catch {
      /* absent */
    }
  }
  return '';
}

export function loadTradesCultureBrief(): string {
  return readRepoMarkdown('TRADES_CULTURE.md', 5500) || TRADES_CULTURE_FALLBACK;
}

/**
 * Brief Enquêteur — VISUAL_LOGIC + règles flux→métier uniquement.
 * Pas de TRADES_CULTURE plomberie (joints / exutoire) qui biaise moisissure → Plombier.
 */
export function loadEnqueteurSavoirBrief(): string {
  const visual = readRepoMarkdown('VISUAL_LOGIC.md', 4000);
  const envelopeSection = visual
    ? visual
    : [
        'Enveloppe R+6 : défaut toiture terrasse → humidité étages bas.',
        'Exutoire 3 verres : amont → logement → aval.',
        'Dalle froide : condensation commerce R-1 → logement R+1.',
      ].join('\n');

  return [
    envelopeSection,
    '',
    'SOUVERAINETÉ MÉTIER (Enquêteur) :',
    '• tradeNeeded = UNIQUEMENT depuis activeFlows + mentalModels + hypothèses actives.',
    '• Jamais depuis le mot symptôme seul (moisissure ≠ Plombier par défaut).',
    '• Flux étanchéité / modèle Enveloppe / toiture / infiltration → Maçon ou Étanchéiste.',
    '• Flux exutoire / refoulement / fuite sous pression → Plombier.',
    '• Sols / carrelage / faïence qui se soulève → Solier ; doute humidité sous-jacente → vérifier exutoire avant de conclure.',
    '• partsToBring = pièces liées au diagnostic réel — INTERDIT : listes génériques « joints », « bouches VMC ».',
  ].join('\n');
}
