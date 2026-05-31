/**
 * Savoir — liens cliniques et sondes (data/lia-liens-cliniques.json).
 * Les agents lisent ; Jarvis synthétise — pas de scénarios codés en TypeScript.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import type { HousingKind } from './lia-housing-perspective';
import type { JarvisFlowKind, PhysicalHypothesis } from './lia-jarvis-simulation.engine';
import {
  shouldSkipSavoirProbeForEquipment,
  extractTenantSignalementFacts,
} from './lia-tenant-signalement-facts';

export interface ClinicalLink {
  id: string;
  requiresHousing: HousingKind[];
  requiresFlows: JarvisFlowKind[];
  signGroups: string[][];
  signGroupsAnd?: Record<string, string[]>;
  /** Indices de signGroups qui doivent matcher dans le message locataire (pas le titre seul). */
  confirmInMessageGroups?: number[];
  resolveStep: string;
  resolveStepsAlso?: string[];
  hypothesisBoost?: { prefix: string; delta: number };
  hypothesisEliminate?: string[];
  completeIntake?: boolean;
  savoirInsight: string;
  tenantExplanation: string;
  transmissionHint?: string;
}

export interface SavoirProbe {
  id: string;
  requiresHousing: HousingKind[];
  requiresFlows: JarvisFlowKind[];
  skipIfResolved: string[];
  /** Au moins un mot-clé doit apparaître dans titre + description + message. */
  contextKeywords?: string[];
  questionFr: string;
  questionGcf?: string;
  questionEn?: string;
}

interface ClinicalLinksCatalog {
  clinicalLinks: ClinicalLink[];
  savoirProbes: SavoirProbe[];
}

let cached: ClinicalLinksCatalog | null = null;

function resolveCatalogPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'lia-liens-cliniques.json'),
    path.join(process.cwd(), '..', '..', 'data', 'lia-liens-cliniques.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'lia-liens-cliniques.json introuvable (cwd=' + process.cwd() + ')',
  );
}

export function loadClinicalLinksCatalog(): ClinicalLinksCatalog {
  if (cached) return cached;
  cached = JSON.parse(
    fs.readFileSync(resolveCatalogPath(), 'utf8'),
  ) as ClinicalLinksCatalog;
  return cached;
}

export function normClinicalText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function groupMatches(ctx: string, groupIndex: number, link: ClinicalLink): boolean {
  const keywords = link.signGroups[groupIndex];
  if (!keywords?.length) return true;
  const base = keywords.some((kw) => ctx.includes(normClinicalText(kw)));
  const andList = link.signGroupsAnd?.[String(groupIndex)];
  if (!andList?.length) return base;
  return base && andList.some((kw) => ctx.includes(normClinicalText(kw)));
}

function groupContextForLink(
  link: ClinicalLink,
  groupIndex: number,
  fullCtx: string,
  messageCtx: string,
): string {
  if (link.confirmInMessageGroups?.includes(groupIndex)) {
    return messageCtx;
  }
  return fullCtx;
}

/** Liens cliniques dont tous les groupes de signes matchent le contexte. */
export function matchClinicalLinks(params: {
  title: string;
  description: string;
  message: string;
  housingKind: HousingKind;
  activeFlows: readonly JarvisFlowKind[];
}): ClinicalLink[] {
  const catalog = loadClinicalLinksCatalog();
  const fullCtx = normClinicalText(
    `${params.title} ${params.description} ${params.message}`,
  );
  const messageCtx = normClinicalText(params.message);

  return catalog.clinicalLinks.filter((link) => {
    if (!link.requiresHousing.includes(params.housingKind)) return false;
    if (!link.requiresFlows.every((f) => params.activeFlows.includes(f))) {
      return false;
    }
    for (let i = 0; i < link.signGroups.length; i++) {
      const ctx = groupContextForLink(link, i, fullCtx, messageCtx);
      if (!groupMatches(ctx, i, link)) return false;
    }
    return true;
  });
}

/** Lien confirmé par le locataire (signes « communes » dans son message). */
export function isTenantConfirmedClinicalLink(link: ClinicalLink, message: string): boolean {
  if (!link.confirmInMessageGroups?.length) return Boolean(message.trim());
  const messageCtx = normClinicalText(message);
  return link.confirmInMessageGroups.every((i) => groupMatches(messageCtx, i, link));
}

function probeMatchesContext(probe: SavoirProbe, ctx: string): boolean {
  if (!probe.contextKeywords?.length) return true;
  return probe.contextKeywords.some((kw) => ctx.includes(normClinicalText(kw)));
}

/** Sonde Savoir applicable (première non encore résolue, contexte signalement). */
export function pickSavoirProbe(params: {
  housingKind: HousingKind;
  activeFlows: readonly JarvisFlowKind[];
  resolvedSteps: string[];
  language: CompanionLanguage;
  title?: string;
  description?: string;
  message?: string;
}): { probe: SavoirProbe; question: string } | null {
  const catalog = loadClinicalLinksCatalog();
  const ctx = normClinicalText(
    `${params.title ?? ''} ${params.description ?? ''} ${params.message ?? ''}`,
  );
  const tenantFacts = extractTenantSignalementFacts({
    title: params.title ?? '',
    description: params.description ?? '',
    message: params.message ?? '',
  });

  for (const probe of catalog.savoirProbes) {
    if (!probe.requiresHousing.includes(params.housingKind)) continue;
    if (!probe.requiresFlows.every((f) => params.activeFlows.includes(f))) {
      continue;
    }
    if (probe.skipIfResolved.some((s) => params.resolvedSteps.includes(s))) {
      continue;
    }
    if (shouldSkipSavoirProbeForEquipment(probe.id, tenantFacts)) continue;
    if (!probeMatchesContext(probe, ctx)) continue;

    const question =
      params.language === 'gcf' && probe.questionGcf
        ? probe.questionGcf
        : probe.questionFr;
    return { probe, question };
  }
  return null;
}

export function probeQuestionMatchesResolved(
  question: string,
  resolvedSteps: string[],
): boolean {
  if (!resolvedSteps.includes('savoir_collective')) return false;
  const n = normClinicalText(question);
  return /voisin|autres logements|parties communes s.?allume/.test(n);
}

/** Effets simulation depuis les liens cliniques Savoir (data). */
export function applyClinicalLinkEffects(params: {
  title: string;
  description: string;
  message: string;
  housingKind: HousingKind;
  activeFlows: readonly JarvisFlowKind[];
  resolvedSteps: string[];
  hypotheses: PhysicalHypothesis[];
}): {
  resolvedSteps: string[];
  hypotheses: PhysicalHypothesis[];
  intakeComplete: boolean;
} {
  const links = matchClinicalLinks({
    title: params.title,
    description: params.description,
    message: params.message,
    housingKind: params.housingKind,
    activeFlows: params.activeFlows,
  });

  let resolved = [...params.resolvedSteps];
  let hypotheses = params.hypotheses.map((h) => ({ ...h }));
  let intakeComplete = false;

  for (const link of links) {
    if (!resolved.includes(link.resolveStep)) resolved.push(link.resolveStep);
    for (const step of link.resolveStepsAlso ?? []) {
      if (!resolved.includes(step)) resolved.push(step);
    }
    if (link.hypothesisBoost) {
      const { prefix, delta } = link.hypothesisBoost;
      hypotheses = hypotheses.map((h) =>
        h.id.includes(prefix)
          ? { ...h, confidence: Math.min(h.confidence + delta, 0.95) }
          : h,
      );
    }
    if (link.hypothesisEliminate) {
      for (const part of link.hypothesisEliminate) {
        hypotheses = hypotheses.map((h) =>
          h.id.includes(part) ? { ...h, active: false, confidence: 0 } : h,
        );
      }
    }
    if (link.completeIntake) intakeComplete = true;
  }

  return { resolvedSteps: resolved, hypotheses, intakeComplete };
}
