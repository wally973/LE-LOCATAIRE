/**
 * Normalisation parole Majordome — jamais de JSON brut dans le chat locataire.
 */

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  return '';
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  try {
    const p = JSON.parse(text) as unknown;
    return p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pickMessageField(obj: Record<string, unknown>): string {
  for (const key of ['tenantMessage', 'message', 'response', 'parole', 'text', 'content']) {
    const v = asString(obj[key]);
    if (v && !v.startsWith('{')) return v;
  }
  return '';
}

/** Extrait la parole locataire depuis la réponse Groq (JSON ou texte). */
export function unwrapMajordomeParole(raw: string | null): string {
  if (!raw?.trim()) return '';

  const trimmed = raw.trim();
  const parsed = tryParseJsonObject(trimmed);
  if (parsed) {
    const msg = pickMessageField(parsed);
    if (msg) return msg;
  }

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return trimmed;
  }

  return '';
}

/** Rejette une chaîne qui ressemble encore à du JSON (fuite UI). */
export function isJsonLeak(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith('{')) return false;
  return /"message"|"tenantMessage"|"action"|awaiting_tenant/i.test(t);
}
