import { detectMasterDomain } from '../diagnostiqueur/rules/master-diagnostic-engine';
import type { TicketDiagnosticContext } from './diagnostic-context.service';
import { detectSocialSignal } from './social-signal-detection';

/** Mapping domaines Savoir-Voir → catégorie ticket (`aiCategory`). */
const MASTER_DOMAIN_TO_AI_CATEGORY: Record<string, string> = {
  ELECTRICITY: 'ELECTRICITY',
  CARPENTRY: 'CARPENTRY',
  VMC: 'HUMIDITY',
  TERMITES: 'OTHER',
  COMMON_AREAS: 'OTHER',
  PLUMBING: 'PLUMBING',
  HEATING: 'HEATING',
  HUMIDITY: 'HUMIDITY',
  ROOFING: 'ROOFING',
  LOCKSMITH: 'LOCKSMITH',
};

const INTAKE_TO_AI_CATEGORY: Record<string, string> = {
  PLUMBING: 'PLUMBING',
  ROOF: 'ROOFING',
  ELECTRICITY: 'ELECTRICITY',
};

function normText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Repli texte lorsque le catalogue master n’a pas encore le domaine (ex. plomberie). */
function fallbackCategoryFromText(text: string): string | null {
  const t = normText(text);
  if (/fuite|plomber|evier|évier|wc|refoulement|canalis/.test(t)) {
    return 'PLUMBING';
  }
  if (/electri|prise|disjonct|tableau/.test(t)) {
    return 'ELECTRICITY';
  }
  if (/humid|moisiss|infiltr/.test(t)) {
    return 'HUMIDITY';
  }
  if (/chauffage|chaudiere|chaudière|radiateur|clim/.test(t)) {
    return 'HEATING';
  }
  if (/serrure|porte bloquee|porte bloquée|cle perdue|clé perdue/.test(t)) {
    return 'LOCKSMITH';
  }
  return null;
}

export type TicketSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT_CRITIQUE';

/** Catégorie métier dérivée du contexte unifié (intake, capteurs, diagnostic Lia). */
export function resolveAiCategoryFromContext(
  ctx: TicketDiagnosticContext,
): string {
  const fromDecision = (ctx.diagnostic as { category?: string } | null)
    ?.category;
  if (fromDecision && fromDecision !== 'OTHER' && fromDecision !== 'GENERIC') {
    return fromDecision;
  }

  const intakeCat = ctx.intake?.category;
  if (intakeCat && intakeCat !== 'GENERIC') {
    return INTAKE_TO_AI_CATEGORY[intakeCat] ?? intakeCat;
  }

  const domain = detectMasterDomain(ctx.caseContext);
  if (domain) {
    return MASTER_DOMAIN_TO_AI_CATEGORY[domain.id] ?? domain.id;
  }

  const fallback = fallbackCategoryFromText(ctx.caseContext);
  if (fallback) return fallback;

  return 'OTHER';
}

/** Sévérité dérivée du diagnostic Lia ou des capteurs critiques. */
export function resolveSeverityFromContext(
  ctx: TicketDiagnosticContext,
): TicketSeverity {
  const fromDecision = (ctx.diagnostic as { severity?: string } | null)
    ?.severity;
  if (
    fromDecision === 'URGENT_CRITIQUE' ||
    fromDecision === 'HIGH' ||
    fromDecision === 'MEDIUM' ||
    fromDecision === 'LOW'
  ) {
    return fromDecision;
  }

  const danger = String(ctx.sensors.danger_signs ?? '');
  if (/grésill|brûl|étincelle|odeur de brûlé/i.test(danger)) {
    return 'URGENT_CRITIQUE';
  }

  const water = String(ctx.sensors.water_aspect ?? '');
  if (/inond|urgence|refoulement/i.test(water)) {
    return 'HIGH';
  }

  if (ctx.savoirVoirPhase === 'CONCLUSION' && ctx.diagnostic?.leadingHypothesisId) {
    return 'MEDIUM';
  }

  return 'LOW';
}

export interface SocialRiskAssessment {
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'IMPAYE' | 'APL' | 'SOCIAL' | 'AUTRE';
  note: string;
  socialSignal: boolean;
}

/** Analyse sociale alignée sur `detectSocialSignal` (même source que le routing Lia). */
export function classifySocialRiskFromText(text: string): SocialRiskAssessment {
  if (!text?.trim()) {
    return {
      risk: 'LOW',
      category: 'AUTRE',
      note: 'Aucun élément social détecté.',
      socialSignal: false,
    };
  }

  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  if (!detectSocialSignal(text)) {
    return {
      risk: 'LOW',
      category: 'AUTRE',
      note: 'Aucun risque social particulier détecté.',
      socialSignal: false,
    };
  }

  if (
    /violence|harcelement|harcèlement|menace|danger|urgence sociale/.test(t)
  ) {
    return {
      risk: 'HIGH',
      category: 'SOCIAL',
      note: 'Risque social élevé — orientation référent prioritaire.',
      socialSignal: true,
    };
  }

  if (/impay|loyer|payer|surendett|expulsion|huissier/.test(t)) {
    return {
      risk: 'MEDIUM',
      category: 'IMPAYE',
      note: 'Difficulté financière ou impayé suspecté.',
      socialSignal: true,
    };
  }

  if (/apl|caf|allocation|rsa|aide sociale/.test(t)) {
    return {
      risk: 'MEDIUM',
      category: 'APL',
      note: 'Situation liée aux aides ou prestations sociales.',
      socialSignal: true,
    };
  }

  return {
    risk: 'MEDIUM',
    category: 'SOCIAL',
    note: 'Signalement à dimension sociale — référent à solliciter.',
    socialSignal: true,
  };
}

/** Résumé court pour dashboards (qualité, social, dispatch). */
export function buildDiagnosticBrief(ctx: TicketDiagnosticContext) {
  return {
    ticketId: ctx.ticketId,
    savoirVoirPhase: ctx.savoirVoirPhase,
    category: resolveAiCategoryFromContext(ctx),
    severity: resolveSeverityFromContext(ctx),
    leadingHypothesisId: ctx.diagnostic?.leadingHypothesisId ?? null,
    sensors: ctx.sensors,
  };
}
