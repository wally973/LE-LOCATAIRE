/**
 * Conseil Jarvis — tous écoutent, chacun réagit si l’écho le concerne (modèle chauve-souris).
 * Jarvis synthétise une seule voix au locataire.
 */
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import { detectPanneFromText } from './panne-diagnostic.loader';
import {
  jarvisSavoirCollectiveSignalQuestion,
  jarvisSavoirFloorOrAboveQuestion,
  jarvisSavoirStandaloneSignalQuestion,
} from './lia-jarvis-dialogue.i18n';
import type {
  CouncilEcho,
  CouncilListenParams,
  CouncilRound,
} from './lia-jarvis-council.types';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function fullContext(title: string, description: string, message: string): string {
  return norm(`${title} ${description} ${message}`);
}

function listenSavoir(params: CouncilListenParams): CouncilEcho | null {
  const ctx = fullContext(params.title, params.description, params.message);
  const flows = params.simulation.activeFlows;
  const lang = params.simulation.language;

  if (!flows.includes('signal') && !/\btv\b|television|reception|signal|chaine/.test(ctx)) {
    return null;
  }

  const heard: string[] = [];
  if (/depuis hier|depuis|hier|ce matin/.test(ctx)) heard.push('depuis hier');
  if (/\btv\b|television|reception|signal|chaine/.test(ctx)) heard.push('réception TV');

  if (params.housing.kind === 'collective') {
    return {
      agent: 'savoir',
      heard: heard.join(', ') || 'réception TV',
      insight: `${params.housing.visualNote} Piste : antenne collective, amplificateur alimenté (parties communes).`,
      suggestedQuestion: jarvisSavoirCollectiveSignalQuestion(lang),
      confidence: 0.78,
    };
  }

  if (params.housing.kind === 'standalone') {
    return {
      agent: 'savoir',
      heard: heard.join(', ') || 'réception TV',
      insight: `${params.housing.visualNote} Piste : poste local ou amont du lot.`,
      suggestedQuestion: jarvisSavoirStandaloneSignalQuestion(lang),
      confidence: 0.74,
    };
  }

  return {
    agent: 'savoir',
    heard: heard.join(', ') || 'réception TV',
    insight: 'Logement non typé — demander en langage vécu (étage / voisin au-dessus).',
    suggestedQuestion: jarvisSavoirFloorOrAboveQuestion(lang),
    confidence: 0.55,
  };
}

function listenVisual(params: CouncilListenParams): CouncilEcho | null {
  const sim = params.simulation;
  if (!sim.visualizationSummary && !params.chainQuestion) return null;

  return {
    agent: 'visual',
    heard: params.message.trim() ? 'message locataire intégré à la scène' : 'ouverture signalement',
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
  const ctx = fullContext(params.title, params.description, params.message);
  if (!/charge locataire|ma faute|ma responsabilite|c est moi qui/.test(ctx)) {
    return null;
  }
  return {
    agent: 'juriste',
    heard: 'responsabilité évoquée',
    insight: 'Nuancer charge — ne pas conclure avant dossier complet.',
    confidence: 0.5,
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

/** Jarvis choisit la question à prononcer — ton technicien, pas le jargon console. */
export function pickCouncilSpokenQuestion(
  consultationQuestion: string | null,
  round: CouncilRound,
): string | null {
  const practicalEchoes = round.echoes
    .filter(
      (e) =>
        e.suggestedQuestion?.trim() &&
        !isMetaDiagnosticQuestion(e.suggestedQuestion),
    )
    .sort((a, b) => b.confidence - a.confidence);

  const savoir = practicalEchoes.find((e) => e.agent === 'savoir');
  if (savoir?.suggestedQuestion) {
    return savoir.suggestedQuestion;
  }

  if (
    consultationQuestion &&
    !isGenericFallbackQuestion(consultationQuestion) &&
    !isMetaDiagnosticQuestion(consultationQuestion)
  ) {
    return consultationQuestion;
  }

  if (practicalEchoes.length) {
    return practicalEchoes[0]!.suggestedQuestion!;
  }

  return consultationQuestion;
}

export function buildComprehensionFragments(round: CouncilRound): string[] {
  const parts: string[] = [];
  for (const e of round.echoes) {
    if (e.heard && !parts.includes(e.heard)) {
      parts.push(e.heard);
    }
  }
  return parts.slice(0, 3);
}

export function councilAgentLabelFr(agent: CouncilEcho['agent']): string {
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
