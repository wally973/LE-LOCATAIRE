/**
 * Archiviste — legal-references + lia-juridique-savoir (AiLegalService, hors intake script).
 */
import type { LegalReferenceEntryDto } from '../../../legal-references/legal-reference.types';
import { LegalReferencesService } from '../../../legal-references/legal-references.service';
import { matchLegalThemes } from './lia-juridique-savoir.loader';
import {
  classifyJarvisSignalementLot,
  shouldApplyLostKeysContext,
} from './lia-jarvis-signalement-scope';
import {
  classifyTripleChargeFlux,
  type TripleChargeFlux,
} from '../../../ai/lia-triple-flux-charge';

export type JarvisResponsibilityHint =
  | 'LOCATAIRE'
  | 'BAILLEUR'
  | 'MIXTE'
  | 'INDETERMINE';

export interface JarvisArchivistBrief {
  themes: import('./lia-juridique-savoir.loader').LegalTheme[];
  citations: LegalReferenceEntryDto[];
  chargeHint: JarvisResponsibilityHint;
  /** Tri triple flux (prioritaire sur chargeHint). */
  chargeFlux?: TripleChargeFlux;
  tenantExplanationFr?: string;
  tripleFluxSummary?: string;
  constraints: string[];
  summary: string;
}

function norm(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function fullContext(title: string, description: string, message: string): string {
  return [title, description, message].filter(Boolean).join(' — ');
}

function detectPlumbingAmontCharge(
  title: string,
  description: string,
  message: string,
): boolean {
  const ctx = norm(fullContext(title, description, message));
  return (
    /robinet|flexible|joint|goutte|mitigeur|t[eê]te de robinet/.test(ctx) &&
    !/refoul|exutoire|bonde|siphon|canalis/.test(ctx)
  );
}

function mentionsLandlordTapBodyWear(ctx: string): boolean {
  const t = norm(ctx);
  return /corps du robinet|robinet.*(use|usé|vétust|vetust|vieux|hors d.?usage)|remplacer.*robinet/.test(
    t,
  );
}

/** Archiviste — AiLegalService + legal-references.json + lia-juridique-savoir.json */
export async function buildArchivistBrief(
  legalReferences: LegalReferencesService,
  params: { title: string; description: string; message: string },
): Promise<JarvisArchivistBrief> {
  const ctx = norm(fullContext(params.title, params.description, params.message));
  const signalementLot = classifyJarvisSignalementLot(ctx);
  const themes = matchLegalThemes(params);
  const catalog = await legalReferences.getCatalog();
  const bySlug = new Map(catalog.entries.map((e) => [e.slug, e]));

  const slugCandidates = new Set<string>([
    'decret-87-712-reparations-locatives',
    'decret-87-713-charges-recuperables',
    'code-civil-1719-bailleur',
    'charge-bailleur-grosses-reparations',
    ...(signalementLot !== 'ELECTRICITY' ? (['serrure-acces-logement'] as const) : []),
  ]);
  for (const theme of themes) {
    if (theme.id === 'serrure_acces_nuance') slugCandidates.add('serrure-acces-logement');
    if (/87-712|locative/.test(theme.legalRefs.join(' '))) {
      slugCandidates.add('decret-87-712-reparations-locatives');
    }
  }

  const citations: LegalReferenceEntryDto[] = [];
  for (const slug of slugCandidates) {
    const entry = bySlug.get(slug);
    if (entry && !citations.some((c) => c.slug === slug)) citations.push(entry);
  }

  const searchHits = await legalReferences.search({
    query: fullContext(params.title, params.description, params.message),
    limit: 6,
  });
  for (const hit of searchHits) {
    if (signalementLot === 'ELECTRICITY' && /serrure|cle-perdue|clef-perdue|acces-logement/.test(hit.slug)) {
      continue;
    }
    if (!citations.some((c) => c.slug === hit.slug)) citations.push(hit);
  }

  const constraints: string[] = [];
  let chargeHint: JarvisResponsibilityHint = 'INDETERMINE';

  if (shouldApplyLostKeysContext(ctx)) {
    chargeHint = 'LOCATAIRE';
    constraints.push(
      'Clés perdues ou oubliées = charge locataire (Décret 87-712 — réparation locative / accès).',
    );
    constraints.push(
      'INTERDIT de promettre au locataire une intervention gratuite du bailleur.',
    );
  }

  if (
    signalementLot !== 'ELECTRICITY' &&
    detectPlumbingAmontCharge(params.title, params.description, params.message)
  ) {
    chargeHint = mentionsLandlordTapBodyWear(ctx) ? 'MIXTE' : 'LOCATAIRE';
    constraints.push(
      'Loi Amont/Aval : robinet / puisage = flux d’ALIMENTATION — charge locataire sauf vétusté corps de robinet.',
    );
  }

  const serrureTheme = themes.find((t) => t.id === 'serrure_acces_nuance');
  if (serrureTheme && chargeHint === 'INDETERMINE') {
    if (/perdu|oublie|cassee.*cl|cl.*cassee/.test(ctx)) {
      chargeHint = 'LOCATAIRE';
    } else if (/usee|usure|ne ferme plus|accroch|pe[cç]ne/.test(ctx)) {
      chargeHint = 'BAILLEUR';
    }
    constraints.push(serrureTheme.chargeHint);
  }

  for (const theme of themes) {
    if (theme.juristeInsight && !constraints.includes(theme.juristeInsight)) {
      constraints.push(theme.juristeInsight);
    }
  }

  const decret = bySlug.get('decret-87-712-reparations-locatives');
  if (decret && chargeHint === 'LOCATAIRE') {
    constraints.push(
      `Référence Archiviste : ${decret.title} — réparations locatives à la charge du locataire sauf vétusté.`,
    );
  }

  const triple = classifyTripleChargeFlux({
    title: params.title,
    description: params.description,
    message: params.message,
  });

  if (triple.flux === 'LOCATIF') chargeHint = 'LOCATAIRE';
  else if (triple.flux === 'PATRIMOINE') chargeHint = 'BAILLEUR';
  else if (triple.flux === 'RECUPERABLE') chargeHint = 'BAILLEUR';

  constraints.push(triple.afpolGrounding);

  const summary = triple.archivisteSummary;

  return {
    themes,
    citations,
    chargeHint,
    chargeFlux: triple.flux,
    tenantExplanationFr: triple.tenantExplanationFr,
    tripleFluxSummary: triple.archivisteSummary,
    constraints,
    summary,
  };
}
