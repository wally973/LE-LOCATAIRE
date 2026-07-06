/**
 * Scores de confiance / qualité Grock (0–10).
 * Internes — jamais exposés au locataire. Modulent les têtes, ne diagnostiquent pas.
 */

/** Couche 0 — qualité du signal d'entrée (préprocesseur). */
export interface SignalQualityMeta {
  textCoherence: number;
  textAmbiguityPenalty: number;
  imageQuality: number | null;
  hasImage: boolean;
  perceptionAvailable: boolean;
}

/** Couche 2 — scores produits par les 5 têtes (noyau). */
export interface GrockHeadScores {
  /** Tête 1 — Analyse */
  factExtractionConfidence?: number;
  /** Tête 2 — Vérification */
  dangerLevel?: number;
  realityCheckConfidence?: number;
  /** Tête 3 — Déduction */
  inferenceConfidence?: number;
  /** Tête 4 — Décision */
  decisionConfidence?: number;
  /** Tête 5 — Résolution */
  communicationIntensity?: number;
}

/** Ensemble complet injecté au journal et aux sondes. */
export interface GrockConfidenceScores extends GrockHeadScores {
  signalQuality?: number;
}

const SCORE_KEYS: (keyof GrockHeadScores)[] = [
  'factExtractionConfidence',
  'dangerLevel',
  'realityCheckConfidence',
  'inferenceConfidence',
  'decisionConfidence',
  'communicationIntensity',
];

export function clampScore(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

/** Extrait l'objet scores du JSON brut Grock. */
export function parseScoresFromGrockRaw(raw: string): GrockHeadScores {
  const result: GrockHeadScores = {};
  try {
    const obj = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
    const scores = obj.scores;
    if (scores && typeof scores === 'object' && !Array.isArray(scores)) {
      for (const key of SCORE_KEYS) {
        const v = clampScore((scores as Record<string, unknown>)[key]);
        if (v !== undefined) result[key] = v;
      }
    }
  } catch {
    // repli regex partiel
    for (const key of SCORE_KEYS) {
      const re = new RegExp(`"${key}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`);
      const m = raw.match(re);
      if (m) {
        const v = clampScore(Number(m[1]));
        if (v !== undefined) result[key] = v;
      }
    }
  }
  return result;
}

export function mergeConfidenceScores(
  signalQuality: number | undefined,
  headScores: GrockHeadScores,
): GrockConfidenceScores {
  return {
    ...(signalQuality !== undefined ? { signalQuality } : {}),
    ...headScores,
  };
}

/** Bloc traçabilité injecté dans thinking si absent. */
export function formatScoresForThinking(scores: GrockConfidenceScores): string {
  const parts: string[] = [];
  if (scores.signalQuality !== undefined) {
    parts.push(`signalQuality=${scores.signalQuality}`);
  }
  for (const key of SCORE_KEYS) {
    const v = scores[key];
    if (v !== undefined) parts.push(`${key}=${v}`);
  }
  return `[SCORES] ${parts.join(' ')}`;
}

/** Injecte les scores dans thinking pour traçabilité doctrine / sondes. */
export function ensureScoresInThinking(
  thinking: string,
  scores: GrockConfidenceScores,
): string {
  const block = formatScoresForThinking(scores);
  if (thinking.includes('[SCORES]')) return thinking;
  const trimmed = thinking.trim();
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

/** Modulation prudence selon signalQuality Couche 0 (injecté au prompt). */
export function renderSignalQualityModulation(signalQuality: number): string {
  if (signalQuality >= 7) {
    return `signalQuality=${signalQuality}/10 — signal fiable ; prudence standard.`;
  }
  if (signalQuality >= 4) {
    return `signalQuality=${signalQuality}/10 — signal moyen ; prudence accrue : favorise NEED_PHOTO ou ASK_ONE_QUESTION avant conclusion ; decisionConfidence modérée.`;
  }
  return `signalQuality=${signalQuality}/10 — signal faible ; prudence élevée : NEED_PHOTO ou UNE question discriminante ; ne conclus pas sans preuve ; decisionConfidence basse.`;
}

export { isDangerCommunicationIncoherent } from './grock-score-modulation';

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
