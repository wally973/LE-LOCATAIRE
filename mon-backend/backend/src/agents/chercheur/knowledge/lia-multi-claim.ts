/**
 * Détection de plusieurs réclamations dans un même texte — un ticket = un sujet.
 */

import type { IntakeCategory } from '../../orchestrateur/intake/lia-intake.service';

export interface DetectedClaim {
  id: string;
  category: IntakeCategory;
  label: string;
  excerpt: string;
}

const electricityPatterns = [
  /pas\s+de\s+courant/i,
  /plus\s+de\s+courant/i,
  /prise/i,
  /prises/i,
  /disjoncteur/i,
  /tableau\s+électrique/i,
  /court[-\s]?circuit/i,
  /électricité/i,
];

/** Détection fiable d'un signalement électricité (courant, prise, disjoncteur…). */
export function detectElectricityClaim(text: string): boolean {
  const raw = text.trim();
  if (!raw) return false;
  const norm = normalizeForMatch(raw);
  return electricityPatterns.some(
    (pattern) => pattern.test(raw) || pattern.test(norm),
  );
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
      ...electricityPatterns,
      /[eé]lectri/i,
      /lumi[eè]re/i,
      /ampoule/i,
      /compteur/i,
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
      /eau chaude/i,
      /chauffe[- ]?eau/i,
    ],
  },
  {
    id: 'heating',
    category: 'GENERIC',
    label: 'Chauffage / radiateurs',
    patterns: [
      /chauffage/i,
      /radiateur/i,
      /chaudi[eè]re/i,
      /calorif[eè]re/i,
      /pas de chauffage/i,
      /il fait froid/i,
    ],
  },
  {
    id: 'building_common',
    category: 'GENERIC',
    label: 'Parties communes / immeuble',
    patterns: [
      /ascenseur/i,
      /parties communes/i,
      /couloir.*(sale|dechets|odeur|insalubr)/i,
      /hall.*(sale|dechets|odeur|insalubr)/i,
      /cage d.?escalier/i,
      /interphone/i,
      /digicode/i,
      /\bvmc\b/i,
      /ventilation collective/i,
      /porte pali[eè]re/i,
    ],
  },
  {
    id: 'pests',
    category: 'GENERIC',
    label: 'Nuisibles / insalubrité',
    patterns: [
      /cafard/i,
      /punaise/i,
      /\brat\b/i,
      /nuisible/i,
      /parasite/i,
      /insalubr/i,
    ],
  },
  {
    id: 'lock',
    category: 'GENERIC',
    label: 'Serrure / clés',
    patterns: [
      /gache|gâche/i,
      /serrure/i,
      /cl[eé] perdue/i,
      /cl[eé] cass/i,
      /porte d.?entr[eé]e.*(coinc|bloqu|ferme pas)/i,
      /(coinc|bloqu|ferme pas).*porte d.?entr[eé]e/i,
    ],
  },
  {
    id: 'residence',
    category: 'GENERIC',
    label: 'Résidence / extérieur',
    patterns: [
      /parking/i,
      /espace[s]? vert/i,
      /aire de jeu/i,
      /portail/i,
      /laverie/i,
      /gardien/i,
      /concierge/i,
    ],
  },
  {
    id: 'neighbor',
    category: 'GENERIC',
    label: 'Voisinage / bruit',
    patterns: [/voisin/i, /tapage/i, /bruit.*(nuit|voisin)/i],
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

function uniqueClauses(clauses: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of clauses) {
    const key = normalizeForMatch(c);
    if (key.length < 8 || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function excerptForRule(full: string, patterns: RegExp[]): string {
  const clauses = clausesFromText(full);
  const matching = uniqueClauses(
    clauses.filter((c) => clauseMatchesRule(c, patterns)),
  );
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
function mergeTitleAndDescription(title: string, description: string): string {
  const t = title.trim();
  const d = description.trim();
  if (!d) return t;
  if (!t || t === d) return d;
  const tBase = t.replace(/…$/u, '').trim();
  if (d.includes(tBase) && tBase.length > 10) return d;
  if (t.includes(d)) return t;
  return `${t}\n${d}`;
}

export function detectMultipleClaims(
  title: string,
  description: string,
): DetectedClaim[] {
  const full = mergeTitleAndDescription(title, description);
  const found: DetectedClaim[] = [];
  const seen = new Set<string>();

  for (const rule of TOPIC_RULES) {
    const excerpt = excerptForRule(full, rule.patterns);
    if (excerpt.length > 0 && !seen.has(rule.id)) {
      seen.add(rule.id);
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
