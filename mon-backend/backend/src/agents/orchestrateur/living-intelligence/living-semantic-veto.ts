/**
 * Veto sémantique N7 — interdit les domaines hors-sujet dans le raisonnement des agents.
 */
export type SemanticSubjectAnchor =
  | 'carrelage'
  | 'humidite'
  | 'electricite'
  | 'plomberie'
  | 'generic';

const FORBIDDEN_BY_SUBJECT: Record<SemanticSubjectAnchor, RegExp[]> = {
  carrelage: [
    /\bmenuiserie\b/i,
    /\btoiture\b/i,
    /\btoit\b/i,
    /\bcl[eé]s?\b/i,
    /\bporte\b/i,
    /\bhuisserie\b/i,
  ],
  humidite: [/\bmenuiserie\b/i, /\bcl[eé]s?\b/i],
  electricite: [/\btoiture\b/i, /\bcarrelage\b/i],
  plomberie: [/\btoiture\b/i, /\bmenuiserie\b/i],
  generic: [],
};

const SUBJECT_SIGNALS: Array<{ subject: SemanticSubjectAnchor; re: RegExp }> = [
  { subject: 'carrelage', re: /\bcarrel|carreau|dalle|sol(?:s)?\s+dur/i },
  { subject: 'humidite', re: /\bmoisi|humid|salp[eè]tre|infiltr|condensation\b/i },
  { subject: 'electricite', re: /\b[eé]lectri|disjonct|arc\b|multiprise|prise\b/i },
  { subject: 'plomberie', re: /\bfuite|eau\b|robinet|canalis|lavabo|[eé]vier/i },
];

function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function resolveSemanticSubject(scope: string): SemanticSubjectAnchor {
  const n = norm(scope);
  for (const { subject, re } of SUBJECT_SIGNALS) {
    if (re.test(n)) return subject;
  }
  return 'generic';
}

export function findSemanticViolations(
  text: string,
  subject: SemanticSubjectAnchor,
): string[] {
  if (subject === 'generic') return [];
  const patterns = FORBIDDEN_BY_SUBJECT[subject] ?? [];
  const hits: string[] = [];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[0]) hits.push(m[0].toLowerCase());
  }
  return [...new Set(hits)];
}

/** Retire les termes interdits d'une chaîne (raisonnement agent). */
export function scrubSemanticViolations(
  text: string,
  subject: SemanticSubjectAnchor,
): string {
  if (!text.trim() || subject === 'generic') return text;
  let out = text;
  for (const re of FORBIDDEN_BY_SUBJECT[subject] ?? []) {
    out = out.replace(re, '[hors-sujet-veto]');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function scrubUnknown(value: unknown, subject: SemanticSubjectAnchor): unknown {
  if (typeof value === 'string') {
    return scrubSemanticViolations(value, subject);
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubUnknown(v, subject));
  }
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = scrubUnknown(v, subject);
    }
    return out;
  }
  return value;
}

/** Purge un rapport expert Paul/Pierre des termes hors ancrage. */
export function sanitizeExpertReport(
  report: Record<string, unknown> | null,
  subject: SemanticSubjectAnchor,
): Record<string, unknown> | null {
  if (!report || subject === 'generic') return report;
  return scrubUnknown(report, subject) as Record<string, unknown>;
}
