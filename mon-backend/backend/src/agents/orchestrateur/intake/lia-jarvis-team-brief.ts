/**
 * Brief équipe Jarvis — Archiviste (loi) + Diagnostiqueur (master-diagnostic-rules)
 * consultés AVANT tout appel Groq. Pas de routage script par cas.
 */
import type { LegalReferenceEntryDto } from '../../../legal-references/legal-reference.types';
import { LegalReferencesService } from '../../../legal-references/legal-references.service';
import {
  detectMasterDomain,
  runMasterDifferential,
} from '../../diagnostiqueur/rules/master-diagnostic-engine';
import { detectPanneFromText } from './panne-diagnostic.loader';
import { matchLegalThemes, type LegalTheme } from './lia-juridique-savoir.loader';
import type { CouncilEcho } from './lia-jarvis-council.types';

export type JarvisResponsibilityHint =
  | 'LOCATAIRE'
  | 'BAILLEUR'
  | 'MIXTE'
  | 'INDETERMINE';

export interface JarvisArchivistBrief {
  themes: LegalTheme[];
  citations: LegalReferenceEntryDto[];
  chargeHint: JarvisResponsibilityHint;
  constraints: string[];
  summary: string;
}

export interface JarvisDiagnosticianBrief {
  domainId: string | null;
  domainLabel: string | null;
  panneRef: string | null;
  leadingHypothesis: string | null;
  responsibilityHint: JarvisResponsibilityHint;
  observation: string | null;
  constraints: string[];
}

export interface JarvisTeamBrief {
  problemSummary: string;
  archivist: JarvisArchivistBrief;
  diagnostician: JarvisDiagnosticianBrief;
  /** Contraintes fusionnées — obéissance obligatoire pour le LLM */
  constraints: string[];
  promptBlock: string;
  councilEchoes: CouncilEcho[];
  consultedRefs: string[];
}

function norm(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function fullContext(title: string, description: string, message: string): string {
  return [title, description, message].filter(Boolean).join(' — ');
}

function mapResponsibility(raw?: string | null): JarvisResponsibilityHint {
  const t = norm(raw ?? '');
  if (/locataire/.test(t)) return 'LOCATAIRE';
  if (/bailleur/.test(t)) return 'BAILLEUR';
  if (/mixte|partag/.test(t)) return 'MIXTE';
  return 'INDETERMINE';
}

function lostKeysSignalement(ctx: string): boolean {
  return /perdu.*cl|cl[eé]s?.*perdu|perdus.*cl|perdu.*clef|clef.*perdu|oublie.*cl|cl.*oublie|sans cl[eé]/.test(
    ctx,
  );
}

/** Archiviste — AiLegalService + legal-references.json + lia-juridique-savoir.json */
export async function buildArchivistBrief(
  legalReferences: LegalReferencesService,
  params: { title: string; description: string; message: string },
): Promise<JarvisArchivistBrief> {
  const ctx = norm(fullContext(params.title, params.description, params.message));
  const themes = matchLegalThemes(params);
  const catalog = await legalReferences.getCatalog();
  const bySlug = new Map(catalog.entries.map((e) => [e.slug, e]));

  const slugCandidates = new Set<string>([
    'decret-87-712-reparations-locatives',
    'serrure-acces-logement',
    'charge-bailleur-grosses-reparations',
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
    if (!citations.some((c) => c.slug === hit.slug)) citations.push(hit);
  }

  const constraints: string[] = [];
  let chargeHint: JarvisResponsibilityHint = 'INDETERMINE';

  if (lostKeysSignalement(ctx)) {
    chargeHint = 'LOCATAIRE';
    constraints.push(
      'Clés perdues ou oubliées = charge locataire (Décret 87-712 — réparation locative / accès).',
    );
    constraints.push(
      'INTERDIT de promettre au locataire une intervention gratuite du bailleur, un technicien secteur « qui va venir », ou une prise en charge implicite.',
    );
    constraints.push(
      'Vérité à dire : le locataire organise et finance le serrurier ; Lia peut transmettre une note informative au bailleur sans promettre de gratuité.',
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

  const serrureRef = bySlug.get('serrure-acces-logement');
  if (serrureRef && lostKeysSignalement(ctx)) {
    constraints.push(`Référence Archiviste : ${serrureRef.summary}`);
  }

  const decret = bySlug.get('decret-87-712-reparations-locatives');
  if (decret && chargeHint === 'LOCATAIRE') {
    constraints.push(
      `Référence Archiviste : ${decret.title} — entretien courant / réparations locatives à la charge du locataire sauf vétusté ou vice de construction.`,
    );
  }

  const summary =
    chargeHint === 'LOCATAIRE'
      ? 'Charge locative probable — ne pas promettre de service bailleur gratuit.'
      : chargeHint === 'BAILLEUR'
        ? 'Charge bailleur probable — intervention bailleur cohérente si dossier complet.'
        : themes[0]?.chargeHint ?? 'Responsabilité à confirmer sur faits + textes.';

  return {
    themes,
    citations,
    chargeHint,
    constraints,
    summary,
  };
}

/** Diagnostiqueur — knowledge/master-diagnostic-rules.json (+ référentiel panne validation) */
export function buildDiagnosticianBrief(params: {
  title: string;
  description: string;
  message: string;
}): JarvisDiagnosticianBrief {
  const ctxText = fullContext(params.title, params.description, params.message);
  const ctx = norm(ctxText);
  const domain = detectMasterDomain(ctxText);
  const panne = detectPanneFromText(ctxText);

  const constraints: string[] = [];
  let observation: string | null = null;
  let leadingHypothesis: string | null = null;
  let responsibilityHint: JarvisResponsibilityHint = 'INDETERMINE';

  if (domain) {
    const diff = runMasterDifferential({ domain, contextText: ctxText });
    observation = diff.observation;
    leadingHypothesis = diff.hypotheses.find((h) => h.id === diff.leadingHypothesisId)?.label ?? null;
    responsibilityHint = mapResponsibility(diff.responsibilityHint);
    constraints.push(
      `master-diagnostic-rules.json — ${domain.label} : ${diff.observation}`,
    );
    if (diff.responsibilityHint) {
      constraints.push(`Responsabilité technique indicative : ${diff.responsibilityHint}.`);
    }
  }

  if (panne) {
    constraints.push(
      `Référentiel panne « ${panne.label} » (${panne.id}) — validation Savoir, pas script linéaire.`,
    );
    if (panne.id === 'PANNE_SERRURE_ACCES' && lostKeysSignalement(ctx)) {
      responsibilityHint = 'LOCATAIRE';
      leadingHypothesis = leadingHypothesis ?? 'Clé perdue ou oubliée';
      constraints.push(
        'PANNE_SERRURE_ACCES — clé perdue : duplication / serrurier souvent à charge locataire.',
      );
    }
  }

  if (lostKeysSignalement(ctx) && responsibilityHint === 'INDETERMINE') {
    responsibilityHint = 'LOCATAIRE';
    leadingHypothesis = leadingHypothesis ?? 'Accès — clés perdues';
    constraints.push(
      'Signalement clair « clés perdues » — pas d’urgence structurelle bailleur ; accès à rouvrir à frais locataire.',
    );
  }

  return {
    domainId: domain?.id ?? null,
    domainLabel: domain?.label ?? null,
    panneRef: panne?.id ?? null,
    leadingHypothesis,
    responsibilityHint,
    observation,
    constraints,
  };
}

export function mergeJarvisTeamBrief(params: {
  title: string;
  description: string;
  message: string;
  archivist: JarvisArchivistBrief;
  diagnostician: JarvisDiagnosticianBrief;
}): JarvisTeamBrief {
  const problemSummary = fullContext(params.title, params.description, params.message);
  const constraints = [
    ...params.archivist.constraints,
    ...params.diagnostician.constraints.filter(
      (c) => !params.archivist.constraints.includes(c),
    ),
  ];

  const consultedRefs = [
    'knowledge/master-diagnostic-rules.json',
    'data/legal-references.json',
    'data/lia-juridique-savoir.json',
    ...(params.diagnostician.panneRef
      ? [`data/panne-diagnostic-logique.json — ${params.diagnostician.panneRef}`]
      : []),
    ...params.archivist.citations.map((c) => `legal-ref:${c.slug}`),
  ];

  const councilEchoes: CouncilEcho[] = [];
  if (params.archivist.themes.length || params.archivist.citations.length) {
    councilEchoes.push({
      agent: 'juriste',
      heard: params.archivist.themes[0]?.id ?? 'references_legales',
      insight: `[Archiviste] ${params.archivist.summary}${
        params.archivist.citations[0]
          ? ` — ${params.archivist.citations[0].title}`
          : ''
      }`,
      confidence: 0.92,
    });
  }
  if (params.diagnostician.domainId || params.diagnostician.panneRef) {
    councilEchoes.push({
      agent: 'pathologiste',
      heard: params.diagnostician.domainId ?? params.diagnostician.panneRef ?? 'diagnostic',
      insight: `[Diagnostiqueur] ${
        params.diagnostician.observation ??
        params.diagnostician.leadingHypothesis ??
        'Analyse master-diagnostic-rules'
      }`,
      confidence: 0.88,
    });
  }

  const brief: JarvisTeamBrief = {
    problemSummary,
    archivist: params.archivist,
    diagnostician: params.diagnostician,
    constraints,
    promptBlock: '',
    councilEchoes,
    consultedRefs,
  };
  brief.promptBlock = formatTeamBriefForPrompt(brief);
  return brief;
}

export function formatTeamBriefForPrompt(brief: JarvisTeamBrief): string {
  const citationLines = brief.archivist.citations
    .slice(0, 4)
    .map((c) => `- ${c.title} : ${c.summary}`);
  const themeLines = brief.archivist.themes.map(
    (t) => `- Thème ${t.id} : ${t.juristeInsight}`,
  );

  return [
    '--- BRIEF ÉQUIPE (consulté AVANT ta réponse — contraintes impératives) ---',
    `Voici le problème : ${brief.problemSummary}`,
    '',
    'Archiviste (AiLegalService + legal-references.json) :',
    ...citationLines,
    ...themeLines,
    `Synthèse charge : ${brief.archivist.chargeHint} — ${brief.archivist.summary}`,
    '',
    'Diagnostiqueur (knowledge/master-diagnostic-rules.json) :',
    brief.diagnostician.domainLabel
      ? `- Domaine : ${brief.diagnostician.domainLabel}`
      : '- Domaine : non identifié dans master-diagnostic-rules',
    brief.diagnostician.leadingHypothesis
      ? `- Hypothèse retenue : ${brief.diagnostician.leadingHypothesis}`
      : null,
    brief.diagnostician.observation ? `- ${brief.diagnostician.observation}` : null,
    `- Responsabilité indicative : ${brief.diagnostician.responsibilityHint}`,
    '',
    'Contraintes impératives pour acknowledgment (parole au locataire) :',
    ...brief.constraints.map((c, i) => `${i + 1}. ${c}`),
    '',
    'Règles de forme : ne cite pas les articles au locataire ; dis la vérité technique et juridique ; ne promets pas ce que les contraintes interdisent.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function teamBriefToJarvisFacts(brief: JarvisTeamBrief): Record<string, string> {
  return {
    archivist_charge: brief.archivist.chargeHint,
    diagnostician_responsibility: brief.diagnostician.responsibilityHint,
    diagnostician_domain: brief.diagnostician.domainId ?? '',
    diagnostician_hypothesis: brief.diagnostician.leadingHypothesis ?? '',
    team_constraints: brief.constraints.slice(0, 6).join(' | '),
    team_consulted_refs: brief.consultedRefs.slice(0, 8).join(', '),
  };
}
