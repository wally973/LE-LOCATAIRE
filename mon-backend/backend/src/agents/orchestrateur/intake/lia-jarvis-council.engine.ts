/**
 * Conseil Jarvis — tous écoutent, chacun réagit si l’écho le concerne (modèle chauve-souris).
 * Jarvis synthétise une seule voix au locataire.
 */
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import { detectPanneFromText } from './panne-diagnostic.loader';
import {
  isTenantConfirmedClinicalLink,
  matchClinicalLinks,
  pickSavoirProbe,
  normClinicalText,
} from './lia-savoir-clinical-links.loader';
import {
  matchLegalThemes,
  pickLegalClarificationProbe,
  countKeywordMatches,
  hasLegalChargeContext,
  shouldUseLegalClarificationProbe,
} from './lia-juridique-savoir.loader';
import {
  isPerimeterQuestionRedundant,
  type TenantSignalementFacts,
} from './lia-tenant-signalement-facts';
import type {
  CouncilEcho,
  CouncilListenParams,
  CouncilRound,
} from './lia-jarvis-council.types';

function norm(raw: string): string {
  return normClinicalText(raw);
}

function fullContext(title: string, description: string, message: string): string {
  return norm(`${title} ${description} ${message}`);
}

function collectiveProbeAnswered(
  ctx: string,
  resolvedSteps: string[],
  message: string,
): boolean {
  if (resolvedSteps.includes('savoir_collective')) return true;
  if (!message.trim()) return false;
  return /voisin|escalier|parties communes|eclairage|éclairage|hall|couloir|commune|palier/.test(
    ctx,
  );
}

function listenSavoir(params: CouncilListenParams): CouncilEcho | null {
  const ctx = fullContext(params.title, params.description, params.message);
  const flows = params.simulation.activeFlows;
  const lang = params.simulation.language;
  const message = params.message.trim();
  const housingKind = params.housing.kind;

  const heard: string[] = [];
  if (/escalier|marche|cage d/.test(ctx)) heard.push('escalier / marche');
  if (/boite|lettre|courrier/.test(ctx)) heard.push('boîte aux lettres');
  if (/interphone|sonnette|digicode/.test(ctx)) heard.push('interphone');
  if (/fenetre|vantail|cremone|crémone|vitrage/.test(ctx)) heard.push('fenêtre');
  if (/store|occultation/.test(ctx)) heard.push('store');
  if (/portail|parking/.test(ctx)) heard.push('portail / parking');
  if (/radiateur|chauffage|thermostat/.test(ctx)) heard.push('chauffage');
  if (/detecteur|fumee|fumée|bip/.test(ctx)) heard.push('détecteur fumée');
  if (/plafond|pluie|infiltr|tache|humide/.test(ctx)) heard.push('infiltration / plafond');

  const links = matchClinicalLinks({
    title: params.title,
    description: params.description,
    message,
    housingKind,
    activeFlows: flows,
  });
  const matchedLink = links[0];
  const linkConfirmed =
    matchedLink != null &&
    isTenantConfirmedClinicalLink(matchedLink, message);

  if (linkConfirmed && matchedLink) {
    return {
      agent: 'savoir',
      heard: heard.join(', ') || matchedLink.id,
      insight: matchedLink.savoirInsight,
      confidence: 0.92,
    };
  }

  const legalProbe = pickLegalClarificationProbe({
    title: params.title,
    description: params.description,
    message: params.message,
    language: lang,
    resolvedSteps: params.simulation.resolvedSteps,
  });

  const probe = pickSavoirProbe({
    housingKind,
    activeFlows: flows,
    resolvedSteps: params.simulation.resolvedSteps,
    language: lang,
    title: params.title,
    description: params.description,
    message: params.message,
  });

  const chargeContext = hasLegalChargeContext(ctx);
  const useLegalProbe = shouldUseLegalClarificationProbe({
    probe: legalProbe,
    chargeContext,
    hasPhysicalProbe: probe != null,
  });

  if (useLegalProbe && legalProbe) {
    return {
      agent: 'savoir',
      heard: legalProbe.theme.id,
      insight: `Clarification faits — ${legalProbe.theme.chargeHint} (juriste murmure en parallèle).`,
      suggestedQuestion: legalProbe.question,
      confidence: 0.8,
    };
  }

  if (probe) {
    return {
      agent: 'savoir',
      heard: heard.join(', ') || probe.probe.id,
      insight: `${params.housing.visualNote} Sonde Savoir : ${probe.probe.id}.`,
      suggestedQuestion: probe.question,
      confidence: 0.78,
    };
  }

  const isSignalTopic =
    flows.includes('signal') ||
    /\btv\b|television|reception|signal|chaine/.test(ctx);

  if (isSignalTopic) {
    if (/depuis hier|depuis|hier|ce matin/.test(ctx)) heard.push('depuis hier');
    if (/\btv\b|television|reception|signal|chaine/.test(ctx)) {
      heard.push('réception TV');
    }
    if (
      /escalier|parties communes|hall|couloir|palier/.test(ctx) &&
      /eclairage|éclairage|lumiere|lumière|souci|panne/.test(ctx)
    ) {
      heard.push('éclairage parties communes');
    }
    if (/voisin/.test(ctx) && /absent|part|pas la|ne sais pas/.test(ctx)) {
      heard.push('voisin absent');
    }

    if (collectiveProbeAnswered(ctx, params.simulation.resolvedSteps, message)) {
      return {
        agent: 'savoir',
        heard: heard.join(', ') || 'réponse collectif',
        insight:
          'Réponse voisinage / parties communes — piste antenne collective ou amplificateur alimenté.',
        confidence: 0.86,
      };
    }
  }

  return null;
}

function listenVisual(params: CouncilListenParams): CouncilEcho | null {
  const sim = params.simulation;
  if (!sim.visualizationSummary && !params.chainQuestion) return null;

  return {
    agent: 'visual',
    heard: params.message.trim() ? 'réponse locataire intégrée' : 'ouverture signalement',
    insight: sim.visualizationSummary || 'Scène 3D en construction.',
    suggestedQuestion: params.chainQuestion ?? undefined,
    confidence: params.chainQuestion ? 0.7 : 0.45,
  };
}

function listenChercheur(params: CouncilListenParams): CouncilEcho | null {
  const ctx = fullContext(params.title, params.description, params.message);
  const panne = detectPanneFromText(`${params.title} ${params.description} ${params.message}`);

  const heard: string[] = [];
  if (/depuis hier|depuis|hier/.test(ctx)) heard.push('apparition récente');
  if (panne) heard.push(`référentiel ${panne.id}`);

  if (!heard.length && !panne) return null;

  return {
    agent: 'chercheur',
    heard: heard.join(', '),
    insight: panne
      ? `Référentiel panne « ${panne.label} » — validation KB, pas script linéaire.`
      : 'Fait temporel : panne récente, pas chronique.',
    confidence: panne ? 0.62 : 0.48,
  };
}

function listenPathologiste(params: CouncilListenParams): CouncilEcho | null {
  const ctx = fullContext(params.title, params.description, params.message);
  const flows = params.simulation.activeFlows;
  const hypos = params.simulation.hypotheses.filter((h) => h.active);

  if (!hypos.length) return null;

  const flowHit = flows.some((f) => {
    if (f === 'signal') return /\btv\b|reception|signal|chaine|antenne|box/.test(ctx);
    if (f === 'eau') return /eau|fuit|coule|goutte/.test(ctx);
    if (f === 'air') return /humid|moisi|condens|vmc|odeur/.test(ctx);
    if (f === 'mécanique') return /porte|frotte|coinc|serrure|gache/.test(ctx);
    return false;
  });

  if (!flowHit && !params.message.trim()) return null;

  const top = [...hypos].sort((a, b) => b.confidence - a.confidence)[0];
  return {
    agent: 'pathologiste',
    heard: top?.label ?? 'hypothèse active',
    insight: top?.visualization ?? 'Différentiel physique en cours.',
    confidence: top?.confidence ?? 0.4,
  };
}

function listenJuriste(params: CouncilListenParams): CouncilEcho | null {
  const themes = matchLegalThemes({
    title: params.title,
    description: params.description,
    message: params.message,
  });
  if (!themes.length) return null;

  const ctx = fullContext(params.title, params.description, params.message);
  let theme = themes[0];
  let bestScore = countKeywordMatches(ctx, theme.contextKeywords);
  for (const candidate of themes.slice(1)) {
    const score = countKeywordMatches(ctx, candidate.contextKeywords);
    if (score > bestScore) {
      theme = candidate;
      bestScore = score;
    }
  }

  return {
    agent: 'juriste',
    heard: theme.id,
    insight: theme.juristeInsight,
    confidence: 0.74,
  };
}

const LISTENERS = [
  listenSavoir,
  listenVisual,
  listenChercheur,
  listenPathologiste,
  listenJuriste,
];

/** Tous les agents écoutent en parallèle — pas d’ordre imposé. */
export function runCouncilRound(params: CouncilListenParams): CouncilRound {
  const echoes: CouncilEcho[] = [];
  for (const listen of LISTENERS) {
    const echo = listen(params);
    if (echo) echoes.push(echo);
  }
  echoes.sort((a, b) => b.confidence - a.confidence);
  return {
    at: new Date().toISOString(),
    message: params.message,
    housing: params.housing,
    echoes,
  };
}

export function isGenericFallbackQuestion(question: string | null | undefined): boolean {
  if (!question?.trim()) return false;
  return /sans tout repeter|sans tout répéter|preciser ce que vous observez/i.test(
    norm(question),
  );
}

/** Questions « métier interne » — restent en console expert, pas au locataire. */
export function isMetaDiagnosticQuestion(question: string | null | undefined): boolean {
  if (!question?.trim()) return false;
  const n = norm(question);
  return (
    /visualis|vizualiz|hesite entre|hésite entre|comparer amont|je compare amont/i.test(
      n,
    ) ||
    /«[^»]+».*«[^»]+»/.test(question) ||
    /amont.*antenne.*box.*logement.*cabl/i.test(n)
  );
}

/** Jarvis choisit la question — priorité Savoir (data), pas scripts code. */
export function pickCouncilSpokenQuestion(
  consultationQuestion: string | null,
  round: CouncilRound,
  resolvedSteps: string[] = [],
  tenantFacts?: TenantSignalementFacts | null,
): string | null {
  if (resolvedSteps.includes('service_meter_link')) {
    return null;
  }

  const practicalEchoes = round.echoes
    .filter(
      (e) =>
        e.suggestedQuestion?.trim() &&
        !isMetaDiagnosticQuestion(e.suggestedQuestion) &&
        !isPerimeterQuestionRedundant(e.suggestedQuestion, tenantFacts),
    )
    .sort((a, b) => b.confidence - a.confidence);

  const savoir = practicalEchoes.find((e) => e.agent === 'savoir');
  if (savoir?.suggestedQuestion) {
    return savoir.suggestedQuestion;
  }

  let consultation = consultationQuestion;
  if (isPerimeterQuestionRedundant(consultation, tenantFacts)) {
    consultation = null;
  }
  if (
    consultation &&
    resolvedSteps.includes('savoir_collective') &&
    /voisin|autres logements|parties communes s.?allume/i.test(norm(consultation))
  ) {
    consultation = null;
  }

  if (
    consultation &&
    !isGenericFallbackQuestion(consultation) &&
    !isMetaDiagnosticQuestion(consultation)
  ) {
    return consultation;
  }

  if (practicalEchoes.length) {
    return practicalEchoes[0]!.suggestedQuestion!;
  }

  return consultation;
}

export function councilAgentLabelFr(agent: CouncilEcho['agent'], insight?: string): string {
  if (insight?.startsWith('[Archiviste]')) return 'Archiviste';
  if (insight?.startsWith('[Diagnostiqueur]')) return 'Diagnostiqueur';
  const map: Record<CouncilEcho['agent'], string> = {
    savoir: 'Savoir',
    visual: 'Visualisation',
    chercheur: 'Chercheur',
    pathologiste: 'Pathologiste',
    juriste: 'Juriste',
  };
  return map[agent];
}

export function serializeCouncilRound(round: CouncilRound): string {
  return JSON.stringify(round);
}

export function parseCouncilRound(raw: string | undefined): CouncilRound | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CouncilRound;
  } catch {
    return null;
  }
}
