/**
 * Savoir juridique — data/lia-juridique-savoir.json (murmures juriste, sondes faits).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import { normClinicalText } from './lia-savoir-clinical-links.loader';
import type { JarvisSimulationState } from './lia-jarvis-simulation.engine';
import {
  extractTenantSignalementFacts,
  isPerimeterLegalProbeRedundant,
} from './lia-tenant-signalement-facts';

export interface LegalTheme {
  id: string;
  contextKeywords: string[];
  chargeHint: string;
  legalRefs: string[];
  juristeInsight: string;
}

export interface LegalClarificationProbe {
  id: string;
  linkedThemeId: string;
  contextKeywords: string[];
  questionFr: string;
  questionGcf?: string;
}

interface JuridiqueSavoirCatalog {
  legalThemes: LegalTheme[];
  legalClarificationProbes: LegalClarificationProbe[];
}

let cached: JuridiqueSavoirCatalog | null = null;

function resolveCatalogPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'lia-juridique-savoir.json'),
    path.join(process.cwd(), '..', '..', 'data', 'lia-juridique-savoir.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'lia-juridique-savoir.json introuvable (cwd=' + process.cwd() + ')',
  );
}

export function loadJuridiqueSavoirCatalog(): JuridiqueSavoirCatalog {
  if (cached) return cached;
  cached = JSON.parse(
    fs.readFileSync(resolveCatalogPath(), 'utf8'),
  ) as JuridiqueSavoirCatalog;
  return cached;
}

function contextMatchesKeywords(ctx: string, keywords: string[]): boolean {
  return keywords.some((kw) => ctx.includes(normClinicalText(kw)));
}

function countKeywordMatches(ctx: string, keywords: string[]): number {
  return keywords.filter((kw) => ctx.includes(normClinicalText(kw))).length;
}

export { countKeywordMatches };

/** Thèmes où Jarvis pose une sonde juridique sans litige charge/procédure explicite. */
const LEGAL_PROBE_WITHOUT_CHARGE = new Set([
  'ascenseur_partie_commune',
  'vmc_ventilation_collective',
  'nuisibles_decence_logement',
  'detecteur_fumee_obligatoire',
  'humidite_moisissure_nuance',
]);

export function shouldUseLegalClarificationProbe(params: {
  probe: { theme: LegalTheme } | null;
  chargeContext: boolean;
  hasPhysicalProbe: boolean;
}): boolean {
  if (!params.probe) return false;
  if (params.chargeContext) return true;
  if (params.hasPhysicalProbe) return false;
  return LEGAL_PROBE_WITHOUT_CHARGE.has(params.probe.theme.id);
}

/** Thèmes juridiques dont les mots-clés matchent le signalement. */
export function matchLegalThemes(params: {
  title: string;
  description: string;
  message: string;
}): LegalTheme[] {
  const catalog = loadJuridiqueSavoirCatalog();
  const ctx = normClinicalText(
    `${params.title} ${params.description} ${params.message}`,
  );

  return catalog.legalThemes.filter((theme) =>
    contextMatchesKeywords(ctx, theme.contextKeywords),
  );
}

/** Contexte où une charge / procédure juridique est évoquée. */
export function hasLegalChargeContext(ctx: string): boolean {
  const n = normClinicalText(ctx);
  return /qui paie|responsabil|locataire ou bailleur|ma faute|bailleur dit|a ma charge|a moi de|reparation locative|retenir.*loyer|ne plus payer|silence|repond pas|pas de reponse|insalubre|partie commune|pas chez moi|decence|delai|relance|hall sale|odeur|semaines/.test(
    n,
  );
}

/** Sonde de clarification (faits) — pas de citation de loi au locataire. */
export function pickLegalClarificationProbe(params: {
  title: string;
  description: string;
  message: string;
  language: CompanionLanguage;
  resolvedSteps?: string[];
}): { probe: LegalClarificationProbe; question: string; theme: LegalTheme } | null {
  if (params.resolvedSteps?.includes('legal_clarification_answered')) {
    return null;
  }

  const catalog = loadJuridiqueSavoirCatalog();
  const ctx = normClinicalText(
    `${params.title} ${params.description} ${params.message}`,
  );
  const tenantFacts = extractTenantSignalementFacts({
    title: params.title,
    description: params.description,
    message: params.message,
  });
  const matchedThemeIds = new Set(
    matchLegalThemes({
      title: params.title,
      description: params.description,
      message: params.message,
    }).map((t) => t.id),
  );
  const chargeContext = hasLegalChargeContext(ctx);

  if (!chargeContext && matchedThemeIds.size === 0) return null;

  let best: { probe: LegalClarificationProbe; question: string; theme: LegalTheme } | null =
    null;
  let bestScore = 0;

  for (const probe of catalog.legalClarificationProbes) {
    if (isPerimeterLegalProbeRedundant(probe.id, tenantFacts)) {
      continue;
    }
    const score = countKeywordMatches(ctx, probe.contextKeywords);
    if (score === 0) continue;
    const theme = catalog.legalThemes.find((t) => t.id === probe.linkedThemeId);
    if (!theme) continue;

    const themeAligned = matchedThemeIds.has(probe.linkedThemeId);
    if (!chargeContext && !themeAligned) continue;

    // Thème juridique repéré → sonde dédiée ; sinon mots-clés charge/procédure seuls.
    const effectiveScore = score + (themeAligned ? 100 : 0);
    if (effectiveScore <= bestScore) continue;

    const question =
      params.language === 'gcf' && probe.questionGcf
        ? probe.questionGcf
        : probe.questionFr;
    best = { probe, question, theme };
    bestScore = effectiveScore;
  }

  return best;
}

/** Marque la sonde juridique d'ouverture comme répondue — clôture intake générique. */
export function applyLegalClarificationToSimulation(params: {
  title: string;
  description: string;
  message: string;
  language: CompanionLanguage;
  prior: JarvisSimulationState | null | undefined;
  sim: JarvisSimulationState;
}): JarvisSimulationState {
  const msg = params.message.trim();
  if (!msg || !params.prior || params.sim.intakeComplete) return params.sim;
  if (params.sim.resolvedSteps.includes('legal_clarification_answered')) {
    return params.sim;
  }

  const tenantFacts = extractTenantSignalementFacts({
    title: params.title,
    description: params.description,
    message: params.message,
    prior: params.prior.tenantFacts ?? null,
  });
  // Correction de sujet (ex. portail vs boîte aux lettres) — pas une réponse juridique.
  if (tenantFacts.subjectCorrected) return params.sim;

  const openingProbe = pickLegalClarificationProbe({
    title: params.title,
    description: params.description,
    message: '',
    language: params.language,
    resolvedSteps: params.prior.resolvedSteps,
  });
  if (!openingProbe || msg.length < 10) return params.sim;

  return {
    ...params.sim,
    resolvedSteps: [
      ...params.sim.resolvedSteps.filter((s) => s !== 'legal_clarification_answered'),
      'legal_clarification_answered',
      openingProbe.probe.id,
    ],
    intakeComplete: true,
  };
}
