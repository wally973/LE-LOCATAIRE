/**
 * Validation d'ancrage N7 — Paul doit confirmer son modèle mental avant parole « guide » de Lia.
 */
import type { LivingVision3D } from './living-building-state.types';
import type { SemanticSubjectAnchor } from './living-semantic-veto';
import { findSemanticViolations } from './living-semantic-veto';

const GUIDE_PHRASE_RE =
  /\bje vous guide\b|\bje t['']guide\b|\bnous allons avancer ensemble\b/i;

function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function collectPaulModels(
  enqueteur: Record<string, unknown> | null,
  vision3d: LivingVision3D,
): string {
  const parts: string[] = [];
  if (enqueteur) {
    for (const key of ['modeleMental', 'modele_mental', 'insight']) {
      const v = enqueteur[key];
      if (typeof v === 'string' && v.trim()) parts.push(v);
    }
    const mm = enqueteur.mentalModels;
    if (Array.isArray(mm)) {
      parts.push(...mm.map(String));
    }
    const v3 = enqueteur.vision3d;
    if (v3 && typeof v3 === 'object') {
      const row = v3 as Record<string, unknown>;
      if (Array.isArray(row.mentalModels)) {
        parts.push(...row.mentalModels.map(String));
      }
    }
  }
  parts.push(...vision3d.mentalModels);
  return norm(parts.join(' '));
}

/** Paul a-t-il aligné son modèle sur l'objet du signalement ? */
export function isPaulAnchoringConfirmed(params: {
  subject: SemanticSubjectAnchor;
  signalementScope: string;
  enqueteur: Record<string, unknown> | null;
  vision3d: LivingVision3D;
}): boolean {
  const scope = norm(params.signalementScope);
  const models = collectPaulModels(params.enqueteur, params.vision3d);

  if (params.enqueteur?.ancrageConfirme === true) {
    return findSemanticViolations(models, params.subject).length === 0;
  }

  if (params.subject === 'carrelage') {
    const aligned =
      /carrel|carreau|dalle|sol|revetement|pression/.test(models) ||
      /carrel|carreau|dalle/.test(scope);
    const violations = findSemanticViolations(models, 'carrelage');
    return aligned && violations.length === 0;
  }

  const element = norm(params.vision3d.element ?? '');
  if (element && scope.includes(element.slice(0, Math.min(6, element.length)))) {
    return findSemanticViolations(models, params.subject).length === 0;
  }

  return (
    models.length > 0 &&
    findSemanticViolations(models, params.subject).length === 0 &&
    (params.enqueteur?.ancrageConfirme === true ||
      Boolean(params.enqueteur?.modeleMental || params.enqueteur?.modele_mental))
  );
}

/** Bloque « Je vous guide » tant que Paul n'a pas validé l'ancrage. */
export function enforceAnchoringGate(params: {
  parole: string;
  anchoringConfirmed: boolean;
  displayName: string;
  subject: SemanticSubjectAnchor;
}): string {
  let text = params.parole.trim();
  if (!text) return text;

  if (!params.anchoringConfirmed && GUIDE_PHRASE_RE.test(text)) {
    const name = params.displayName.trim() || 'Marie';
    return (
      `${name}, je reprends votre signalement pour m'assurer que nous parlons du même élément sur place — ` +
      `Paul aligne encore son modèle (${params.subject === 'carrelage' ? 'sol / carrelage' : 'élément signalé'}).`
    );
  }

  return text;
}
