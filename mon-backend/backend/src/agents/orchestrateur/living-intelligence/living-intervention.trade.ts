/**
 * Souveraineté métier — intervention dérivée UNIQUEMENT des flux physiques (vision3d).
 * L'Enquêteur propose ; le merge recalcule ou corrige si incohérent (ex. Plombier sur Enveloppe).
 */
import type { LivingVision3D } from './living-building-state.types';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Pièces génériques interdites hors flux plomberie / exutoire. */
const GENERIC_PART_PATTERNS: RegExp[] = [
  /joints?\s+et\s+(les\s+)?bouches/i,
  /joints?\s+(de\s+)?(silicone|robinet|douche|évier|evier)/i,
  /bouches?\s+d['']extraction/i,
  /bouches?\s+(vmc|ventilation|extraction)/i,
  /^joints?\s*$/i,
  /^bouches?\s*$/i,
];

function corpusFromVision(vision: LivingVision3D, signalement: string): string {
  return norm(
    [
      signalement,
      vision.symptomAnchor ?? '',
      vision.element ?? '',
      vision.above ?? '',
      vision.below ?? '',
      ...vision.activeFlows,
      ...vision.mentalModels,
      ...vision.hypotheses.filter((h) => h.active).map((h) => `${h.label} ${h.visualization}`),
    ].join(' '),
  );
}

function flowsInclude(vision: LivingVision3D, re: RegExp): boolean {
  return vision.activeFlows.some((f) => re.test(norm(f)));
}

function modelsInclude(vision: LivingVision3D, re: RegExp): boolean {
  return vision.mentalModels.some((m) => re.test(norm(m)));
}

/** Métier déterministe à partir des flux / modèles mentaux — null si indéterminé. */
export function deriveSovereignTradeFromVision(
  vision: LivingVision3D,
  signalement: string,
): string | null {
  const ctx = corpusFromVision(vision, signalement);

  if (
    /electri|courant|arc|gr[eé]sill|disjonct|prise|tableau/.test(ctx) &&
    (flowsInclude(vision, /[eé]lectri/) || modelsInclude(vision, /[eé]lectri/))
  ) {
    return 'Électricien';
  }

  const envelopeSignal =
    flowsInclude(vision, /[eé]tanch[eé]it|enveloppe|toiture|infiltr/) ||
    modelsInclude(vision, /enveloppe|dalle froide/) ||
    /[eé]tanch[eé]it|enveloppe|toiture|infiltr|membrane|facade|fa[cç]ade|terrasse|moisiss|humidit|salp[eè]tre/.test(
      ctx,
    );

  if (envelopeSignal) {
    if (/terrasse|membrane|toiture.?terrasse|[eé]tanch[eé]iste/.test(ctx)) {
      return 'Étanchéiste';
    }
    return 'Maçon';
  }

  if (
    flowsInclude(vision, /exutoire|refoul|plomb|canalis|siphon|pression/) ||
    /fuite|refoul|robinet|siphon|colonne eu|flexible|evier|évier|wc\b/.test(ctx)
  ) {
    return 'Plombier';
  }

  if (flowsInclude(vision, /vmc|ventil|air/) || /vmc|ventilation|extraction|bouches?/.test(ctx)) {
    return 'Ventiliste';
  }

  if (
    /carrel|fa[iï]ence|dalle.*(sol|soul)|soul[eè]v|d[eé]coll|plancher|rev[eê]tement.*sol|sol.*(casse|fiss)|carreau/.test(
      ctx,
    ) ||
    flowsInclude(vision, /sol|carrel|plancher/) ||
    modelsInclude(vision, /sol|carrel|dalle/)
  ) {
    return 'Solier';
  }

  if (/porte|g[aâ]che|serrure|menuiser|fenetre|fenêtre|volet/.test(ctx)) {
    return 'Menuisier';
  }

  if (/chauffage|clim|radiateur|hvac|chaudi[eè]re/.test(ctx)) {
    return 'Technicien CVC';
  }

  return null;
}

function tradesEquivalent(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (/macon|maçon/.test(na) && /macon|maçon|etancheiste|étanchéiste/.test(nb)) return true;
  if (/etancheiste|étanchéiste/.test(na) && /macon|maçon|etancheiste|étanchéiste/.test(nb)) {
    return true;
  }
  return false;
}

/** Plombier incohérent avec enveloppe / étanchéité / moisissure sans fuite active. */
export function isPlumberMismatchForEnvelope(
  trade: string | null,
  vision: LivingVision3D,
  signalement: string,
): boolean {
  if (!trade || !/plomb/.test(norm(trade))) return false;

  const ctx = corpusFromVision(vision, signalement);
  const envelope =
    flowsInclude(vision, /[eé]tanch[eé]it|enveloppe|toiture/) ||
    modelsInclude(vision, /enveloppe/) ||
    /[eé]tanch[eé]it|enveloppe|moisiss|infiltr|toiture|salp[eè]tre/.test(ctx);

  const activePlumbingLeak =
    flowsInclude(vision, /exutoire|refoul|pression|plomb/) ||
    /fuite|refoul|robinet|siphon|coule|goutte/.test(ctx);

  return envelope && !activePlumbingLeak;
}

/**
 * Réconcilie le métier proposé par l'Enquêteur avec la physique du dossier.
 * Les flux actifs priment sur toute déduction par mot-clé symptôme.
 */
export function reconcileEnqueteurTrade(
  enqueteurTrade: string | null,
  vision: LivingVision3D,
  signalement: string,
): string | null {
  const sovereign = deriveSovereignTradeFromVision(vision, signalement);

  if (isPlumberMismatchForEnvelope(enqueteurTrade, vision, signalement) && sovereign) {
    return sovereign;
  }

  if (vision.activeFlows.length > 0 && sovereign) {
    if (!enqueteurTrade || !tradesEquivalent(enqueteurTrade, sovereign)) {
      return sovereign;
    }
  }

  if (!enqueteurTrade && sovereign) return sovereign;
  return enqueteurTrade;
}

/** Retire les listes génériques « joints / bouches » hors contexte plomberie. */
export function sanitizePartsToBring(
  parts: string[],
  vision: LivingVision3D,
): string[] {
  const flowText = vision.activeFlows.map(norm).join(' ');
  const isPlumbingFlow = /exutoire|refoul|plomb|pression|siphon|canalis|fuite/.test(flowText);
  const isEnvelopeFlow =
    /[eé]tanch[eé]it|enveloppe|toiture|infiltr/.test(flowText) ||
    vision.mentalModels.some((m) => /enveloppe/i.test(m));

  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((part) => {
      if (!isEnvelopeFlow || isPlumbingFlow) return true;
      return !GENERIC_PART_PATTERNS.some((re) => re.test(part));
    });
}
