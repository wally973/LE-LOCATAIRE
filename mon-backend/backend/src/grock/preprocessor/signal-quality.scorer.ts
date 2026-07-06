import type { GrockChatMessage } from '../grock.service';
import type { SignalQualityMeta } from '../kernel/grock-confidence-scores';
import { clampScore } from '../kernel/grock-confidence-scores';

/** Indices de qualité visuelle dans la perception brute — pas un diagnostic. */
const IMAGE_QUALITY_PENALTY =
  /flou|sombre|obscur|illisible|trop (loin|pr[eè]s)|angle|pixelis|surexpos|sous-expos|peu lisible|partiellement visible|hors champ|noir total|impossible de distinguer/i;

const IMAGE_QUALITY_BONUS =
  /disposition|haute d[eé]finition|mat[eé]riau|joint|surface|mur|plafond|sol/i;

const TEXT_AMBIGUITY =
  /peut[- ]?être|je crois|je pense|pas s[uû]r|je sais pas|aucune id[eé]e|je ne vois pas|flou/i;

/**
 * Score Couche 0 — qualité du signal d'entrée (0–10).
 * Mesure netteté, lisibilité, lumière, ambiguïté, cohérence texte — jamais de diagnostic.
 */
export function scoreSignalQuality(input: {
  title: string;
  description: string;
  tenantMessage: string;
  sessionMessages: GrockChatMessage[];
  visualPerceptionRaw: string | null;
  hasImage: boolean;
}): { signalQuality: number; factors: SignalQualityMeta } {
  const combinedText = [
    input.title,
    input.description,
    input.tenantMessage,
    ...input.sessionMessages.map((m) => m.text),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  let textCoherence = 5;
  if (combinedText.length >= 40) textCoherence += 1;
  if (combinedText.length >= 120) textCoherence += 1;
  if (input.title.trim().length >= 8) textCoherence += 0.5;
  if (input.description.trim().length >= 15) textCoherence += 0.5;
  if (combinedText.length < 20) textCoherence -= 2;

  let textAmbiguityPenalty = 0;
  const ambiguityHits = (combinedText.match(new RegExp(TEXT_AMBIGUITY.source, 'gi')) ?? [])
    .length;
  textAmbiguityPenalty = Math.min(3, ambiguityHits * 0.75);

  let imageQuality: number | null = null;
  if (input.hasImage) {
    if (!input.visualPerceptionRaw?.trim()) {
      imageQuality = 3;
    } else {
      const perc = input.visualPerceptionRaw;
      imageQuality = 6;
      if (IMAGE_QUALITY_PENALTY.test(perc)) imageQuality -= 2;
      if (IMAGE_QUALITY_BONUS.test(perc)) imageQuality += 1;
      if (perc.length >= 200) imageQuality += 0.5;
      if (perc.length < 80) imageQuality -= 1;
    }
  }

  const textScore = clampScore(textCoherence - textAmbiguityPenalty) ?? 5;
  const raw =
    imageQuality !== null
      ? textScore * 0.45 + imageQuality * 0.55
      : textScore;
  const signalQuality = clampScore(raw) ?? 5;

  return {
    signalQuality,
    factors: {
      textCoherence: clampScore(textCoherence) ?? 5,
      textAmbiguityPenalty,
      imageQuality,
      hasImage: input.hasImage,
      perceptionAvailable: Boolean(input.visualPerceptionRaw?.trim()),
    },
  };
}
