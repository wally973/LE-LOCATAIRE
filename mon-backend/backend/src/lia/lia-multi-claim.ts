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
      /\beau\b/i,
    ],
  },
];

function splitSentences(text: string): string[] {
  return text
    .split(/[\n.!?;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Repère 0, 1 ou plusieurs sujets distincts (WC + élec = 2). */
export function detectMultipleClaims(
  title: string,
  description: string,
): DetectedClaim[] {
  const full = `${title}\n${description}`.trim();
  const normFull = normalizeForMatch(full);
  const sentences = splitSentences(full);
  const found: DetectedClaim[] = [];
  const seen = new Set<IntakeCategory>();

  for (const rule of TOPIC_RULES) {
    const matching = sentences.filter((s) =>
      rule.patterns.some((p) => p.test(normalizeForMatch(s))),
    );
    if (
      matching.length === 0 &&
      rule.patterns.some((p) => p.test(normFull))
    ) {
      matching.push(full.slice(0, 280));
    }
    if (matching.length > 0 && !seen.has(rule.category)) {
      seen.add(rule.category);
      found.push({
        id: rule.id,
        category: rule.category,
        label: rule.label,
        excerpt: matching.join(' · ').trim().slice(0, 500),
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
