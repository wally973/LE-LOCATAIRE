/** Cœur Living Intelligence — actif par défaut si Groq disponible. */
export function isLivingIntelligenceEnabled(): boolean {
  if (process.env.LIVING_INTELLIGENCE === 'false') return false;
  if (process.env.JARVIS_STATE_REASONING === 'false') return false;
  if (process.env.JARVIS_LLM_BRIDGE === 'false') return false;
  if (process.env.LIA_HOST_ENABLED === 'false') return false;
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export const GROQ_MODEL_MAJORDOME =
  process.env.GROQ_MAJORDOME_MODEL ?? 'llama-3.3-70b-versatile';

export const GROQ_MODEL_ENQUETEUR =
  process.env.GROQ_ENQUETEUR_MODEL ?? 'llama-3.1-8b-instant';

export const GROQ_MODEL_ARCHIVISTE =
  process.env.GROQ_ARCHIVISTE_MODEL ?? 'llama-3.1-8b-instant';
