/** Cœur Living Intelligence — actif si Groq ou Mistral (Grock) disponible. */
export function isLivingIntelligenceEnabled(): boolean {
  if (process.env.LIVING_INTELLIGENCE === 'false') return false;
  if (process.env.JARVIS_STATE_REASONING === 'false') return false;
  if (process.env.JARVIS_LLM_BRIDGE === 'false') return false;
  if (process.env.LIA_HOST_ENABLED === 'false') return false;
  return (
    Boolean(process.env.MISTRAL_API_KEY?.trim()) ||
    Boolean(process.env.GROQ_API_KEY?.trim())
  );
}

export const GROQ_MODEL_MAJORDOME =
  process.env.GROQ_MAJORDOME_MODEL ?? 'llama-3.3-70b-versatile';

export const GROQ_MODEL_ENQUETEUR =
  process.env.GROQ_ENQUETEUR_MODEL ?? 'llama-3.1-8b-instant';

export const GROQ_MODEL_ARCHIVISTE =
  process.env.GROQ_ARCHIVISTE_MODEL ?? 'llama-3.1-8b-instant';

/** Intercom Maître — modèle léger (évite le quota TPD du 70B en éducation). */
export const GROQ_MODEL_INTERCOM =
  process.env.GROQ_INTERCOM_MODEL ?? 'llama-3.1-8b-instant';

export const GROQ_INTERCOM_FALLBACK_MODEL =
  process.env.GROQ_INTERCOM_FALLBACK_MODEL ?? 'llama-3.1-8b-instant';

/** Grock mono-agent — Mistral (dialogue FR). */
export const GROCK_MISTRAL_MODEL =
  process.env.GROCK_MODEL?.trim() ??
  process.env.MISTRAL_GROCK_MODEL?.trim() ??
  process.env.MISTRAL_MODEL?.trim() ??
  'mistral-small-latest';

export const GROCK_MISTRAL_FALLBACK_MODEL =
  process.env.GROCK_FALLBACK_MODEL?.trim() ?? 'open-mistral-nemo';

/**
 * Repli quand une IMAGE est jointe au raisonnement : le repli texte
 * (open-mistral-nemo) n'est PAS multimodal et renvoie HTTP 400 dès qu'on lui
 * envoie une image. On bascule donc vers un modèle capable de vision, sinon le
 * tour serait perdu sur une simple saturation (429) du modèle principal.
 */
export const GROCK_MISTRAL_VISION_FALLBACK_MODEL =
  process.env.GROCK_VISION_FALLBACK_MODEL?.trim() ?? 'pixtral-12b-2409';

/** Grock — perception visuelle brute (Pixtral). */
export const GROCK_VISION_MODEL =
  process.env.GROCK_VISION_MODEL?.trim() ??
  process.env.MISTRAL_VISION_MODEL?.trim() ??
  'pixtral-12b-2409';

/** @deprecated Groq — conservé pour STT Whisper et hôte Lia legacy */
export const GROCK_FALLBACK_MODEL =
  process.env.GROCK_FALLBACK_MODEL ??
  process.env.GROQ_INTERCOM_FALLBACK_MODEL ??
  'llama-3.1-8b-instant';
