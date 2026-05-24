/**
 * Contexte « dossier locataire » pour les règles métier — sans le brief interne recherche.
 */
import { buildIntakeSummary, type LiaIntakeState } from './lia-intake.service';

const INTERNAL_BRIEF_MARKER = '=== Recherche interne';

/** Sépare le feedback pipeline : précisions locataire vs brief bibliothécaire. */
export function splitPipelineFeedback(feedback?: string): {
  tenantSupplement: string;
  internalBrief: string;
} {
  const raw = feedback?.trim() ?? '';
  if (!raw.includes(INTERNAL_BRIEF_MARKER)) {
    return { tenantSupplement: raw, internalBrief: '' };
  }
  const idx = raw.indexOf(INTERNAL_BRIEF_MARKER);
  return {
    tenantSupplement: raw.slice(0, idx).trim(),
    internalBrief: raw.slice(idx).trim(),
  };
}

/** Texte utilisé par pathologiste / juriste (règles déterministes uniquement). */
export function buildTenantCaseContext(params: {
  title: string;
  description: string;
  intake?: LiaIntakeState | null;
  tenantSupplement?: string;
}): string {
  const parts = [params.title, params.description];
  if (params.intake) {
    parts.push(buildIntakeSummary(params.intake));
  }
  if (params.tenantSupplement?.trim()) {
    parts.push(params.tenantSupplement);
  }
  return parts.filter(Boolean).join('\n');
}
