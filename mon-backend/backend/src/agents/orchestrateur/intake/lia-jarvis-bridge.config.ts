/** Pont LLM Jarvis actif (Groq) — remplace le moteur script JSON. */
export function isJarvisLlmBridgeEnabled(): boolean {
  if (process.env.JARVIS_LLM_BRIDGE === 'false') return false;
  if (process.env.LIA_HOST_ENABLED === 'false') return false;
  return Boolean(process.env.GROQ_API_KEY?.trim());
}
