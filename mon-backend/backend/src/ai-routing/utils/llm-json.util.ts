/**
 * Extrait un objet JSON d'une réponse LLM (parfois entourée de markdown).
 */
export function parseJsonFromLlm<T>(raw: string): T {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const body = fence ? fence[1]!.trim() : trimmed;
  return JSON.parse(body) as T;
}
