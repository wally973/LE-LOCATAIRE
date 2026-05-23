/**
 * Détection de plusieurs réclamations dans un même texte — un ticket = un sujet.
 */

import type { IntakeCategory } from './lia-intake.service';

export interface DetectedClaim {
  id: string;
  category: IntakeCategory;
  label: string;
  excerpt: string;
}

const TOPIC_RULES: {
  id: string;
  category: IntakeCategory;
  label: string;
  patterns: RegExp[];
}[] = [
  {
    id: 'roof',
    category: 'ROOF',
    label: 'Toiture / infiltration',
    patterns: [
      /toiture/i,
      /toit\b/i,
      /infiltration/i,
      /pluie/i,
      /goutti[eè]re/i,
    ],
  },
  {
    id: 'electricity',
    category: 'ELECTRICITY',
    label: 'Électricité / éclairage',
    patterns: [
      /[eé]lectri/i,
      /lumi[eè]re/i,
      /ampoule/i,
      /disjoncteur/i,
      /compteur/i,
      /plus de courant/i,
      /panne.*(courant|[eé]lec)/i,
    ],
  },
  {
    id: 'plumbing',
    category: 'PLUMBING',
    label: 'Plomberie / eau / WC',
    patterns: [
      /fuite/i,
      /\bwc\b/i,
      /toilet/i,
      /[eé]vier/i,
      /lavabo/i,
      /siphon/i,
      /robinet/i,
      /canalis/i,
      /(?:^|\s|[''])eau(?:\s|$)/i,
    ],
  },
];

function splitSentences(text: string): string[] {
  return text
    .split(/[\n.!?;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

/** Découpe aussi sur « et » pour séparer deux sujets dans une phrase. */
function clausesFromText(text: string): string[] {
  const parts: string[] = [];
  for (const sentence of splitSentences(text)) {
    const chunks = sentence
      .split(/\bet\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    if (chunks.length > 1) {
      parts.push(...chunks);
    } else if (sentence.length > 0) {
      parts.push(sentence);
    }
  }
  const trimmed = text.trim();
  if (parts.length === 0 && trimmed.length > 0) {
    return [trimmed];
  }
  return parts;
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function clauseMatchesRule(clause: string, patterns: RegExp[]): boolean {
  const norm = normalizeForMatch(clause);
  return patterns.some((p) => p.test(norm));
}

function excerptForRule(full: string, patterns: RegExp[]): string {
  const clauses = clausesFromText(full);
  const matching = clauses.filter((c) => clauseMatchesRule(c, patterns));
  if (matching.length > 0) {
    return matching.join(' · ').trim().slice(0, 500);
  }

  const norm = normalizeForMatch(full);
  for (const p of patterns) {
    const m = p.exec(norm);
    if (m && m.index != null) {
      const ratio = full.length / Math.max(norm.length, 1);
      const start = Math.max(0, Math.floor(m.index * ratio) - 15);
      return full.slice(start, start + 220).trim();
    }
  }
  return '';
}

/** Repère 0, 1 ou plusieurs sujets distincts (WC + élec = 2). */
export function detectMultipleClaims(
  title: string,
  description: string,
): DetectedClaim[] {
  const full = `${title}\n${description}`.trim();
  const found: DetectedClaim[] = [];
  const seen = new Set<IntakeCategory>();

  for (const rule of TOPIC_RULES) {
    const excerpt = excerptForRule(full, rule.patterns);
    if (excerpt.length > 0 && !seen.has(rule.category)) {
      seen.add(rule.category);
      found.push({
        id: rule.id,
        category: rule.category,
        label: rule.label,
        excerpt,
      });
    }
  }

  return found;
}

/** Message locataire = autre catégorie que le dossier ouvert. */
export function isDifferentClaimTopic(
  message: string,
  ticketTitle: string,
  ticketDescription: string,
  ticketCategory?: IntakeCategory | null,
): boolean {
  const msgClaims = detectMultipleClaims(message, message);
  const ticketClaims = detectMultipleClaims(ticketTitle, ticketDescription);
  const ticketCat =
    ticketCategory ?? ticketClaims[0]?.category ?? null;
  if (!ticketCat) return msgClaims.length > 0;

  if (msgClaims.length === 0) return false;
  if (msgClaims.length > 1) return true;

  return msgClaims[0].category !== ticketCat;
}

export function categoryLabel(category: IntakeCategory): string {
  const rule = TOPIC_RULES.find((r) => r.category === category);
  return rule?.label ?? category;
}
