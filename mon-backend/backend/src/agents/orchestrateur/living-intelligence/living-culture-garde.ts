/**
 * Garde culturelle — Droit à l'ignorance · Auto-culture Paul · Anti-boucle Lia.
 * L'IA consulte knowledge/ avant de harceler Marie.
 */
import { loadClimatTropicalCatalog } from '../../chercheur/knowledge/climat-tropical-catalog.loader';
import { rankPathologyEntriesForContext } from '../../shared/lia-diagnostic-state';
import { loadPathologyIndex } from '../../chercheur/research/knowledge-index.loader';
import {
  consultEnqueteurSavoir,
  prepareLivingSavoirForDeliberation,
} from './living-savoir-consultation';
import type { LivingSavoirConsultation } from './living-building-state.types';

export const DOCTRINE_IDENTIFIED_LABEL = 'IDENTIFIÉE PAR DOCTRINE';
export const LIA_QUESTIONS_JARVIS_KEY = 'lia_questions_posees';
export const DOCTRINE_VARIABLES_JARVIS_KEY = 'doctrine_variables';

const STRUCTURAL_KEYWORDS =
  /\b(carrelage|carreau|carreaux|dalle|plancher|sol\b|faïence|faience|mur\b|murs|cloison|paroi|vide\s+sanitaire|fondation|chape|toiture|tôle|tole|bac\s+acier|pilotis|mangrove|corrosion|clim\b|climatisation|split|chauffe[\s-]?eau|solaire|condensation|infiltration)\b/i;

const IGNORANCE_SIGNAL =
  /\b(je\s+ne\s+sais\s+pas|je\s+sais\s+pas|aucune\s+id[eé]e|pas\s+au\s+courant|je\s+n['']en\s+sais\s+rien|impossible\s+de\s+dire|personne\s+ne\s+sait|(?:non|rien)\s*,?\s*(?:rien|simplement|juste)|simplement\s+que|pas\s+vraiment|je\s+ne\s+peux\s+pas\s+dire)\b/i;

/** Réponse courte = le locataire n'a pas l'info technique — droit à l'ignorance. */
export function isTenantIgnorance(message: string): boolean {
  const t = message.trim();
  if (!t) return true;
  if (IGNORANCE_SIGNAL.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= 14 && !/\d/.test(t) && !/\?/.test(t);
}

export function parseJsonJarvisArray(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function parseJsonJarvisRecord(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) out[k] = val.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function normalizeQuestionKey(q: string): string {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function questionAlreadyAsked(question: string, history: string[]): boolean {
  const key = normalizeQuestionKey(question);
  if (!key) return false;
  return history.some((h) => {
    const hk = normalizeQuestionKey(h);
    if (!hk) return false;
    if (hk === key) return true;
    if (hk.includes(key) || key.includes(hk)) return true;
    const hkTokens = new Set(hk.split(' ').filter((w) => w.length > 3));
    const keyTokens = key.split(' ').filter((w) => w.length > 3);
    const overlap = keyTokens.filter((w) => hkTokens.has(w)).length;
    return overlap >= Math.min(3, keyTokens.length);
  });
}

/** Paul — RAG interne dès qu'un mot-clé structurel apparaît. */
export function buildPaulAutoCulturePack(contextText: string): {
  structural: boolean;
  brief: string;
  hypotheses: Array<{ label: string; score: number; hint?: string }>;
  tropicalNotes: string[];
  savoirConsulted: LivingSavoirConsultation[];
} {
  const structural = STRUCTURAL_KEYWORDS.test(contextText);
  const enq = consultEnqueteurSavoir(contextText);
  const tropicalNotes: string[] = [];

  if (structural) {
    try {
      const catalog = loadClimatTropicalCatalog();
      const ctx = contextText.toLowerCase();
      for (const src of catalog.sources) {
        const hit =
          src.keywords.some((k) => ctx.includes(k.toLowerCase())) ||
          src.topics.some((t) => ctx.includes(t.toLowerCase()));
        if (hit) tropicalNotes.push(`${src.corpus} — ${src.title}: ${src.summary.slice(0, 600)}`);
      }
    } catch {
      /* catalogue absent */
    }
  }

  let hypotheses: Array<{ label: string; score: number; hint?: string }> = [];
  try {
    loadPathologyIndex();
    hypotheses = rankPathologyEntriesForContext(contextText, 4).map((r) => ({
      label: r.entry.label,
      score: r.score,
      hint: r.entry.responsibilityHint ?? undefined,
    }));
  } catch {
    /* index absent */
  }

  const briefParts = [
    structural
      ? 'AUTO-CULTURE PAUL — mot-clé structurel détecté : consulter bibliothequeSavoir AVANT toute 2e question locataire.'
      : 'AUTO-CULTURE PAUL — consulter fiches AFPOL/AQC si lacune.',
    enq.perceptionBrief,
    tropicalNotes.length
      ? `Typologie Guyane / tropical : ${tropicalNotes.slice(0, 2).join(' · ')}`
      : '',
    hypotheses.length
      ? `Pistes probables : ${hypotheses
          .slice(0, 3)
          .map((h) => `${h.label} (~${Math.round(h.score * 100)}%)`)
          .join(' · ')}`
      : '',
  ].filter(Boolean);

  return {
    structural,
    brief: briefParts.join('\n'),
    hypotheses,
    tropicalNotes,
    savoirConsulted: enq.consultations,
  };
}

/** Infère une variable quand Marie ne sait pas — statut IDENTIFIÉE PAR DOCTRINE. */
export function inferDoctrineVariable(params: {
  contextText: string;
  lastQuestion?: string;
}): { key: string; value: string } | null {
  const ctx = params.contextText.toLowerCase();
  const q = (params.lastQuestion ?? '').toLowerCase();
  const pack = buildPaulAutoCulturePack(params.contextText);
  const top = pack.hypotheses[0];

  if (/vide\s+sanitaire|dalle\s+pleine|support|sous\s+(?:le\s+)?(?:carrelage|sol)/.test(q)) {
    if (/carrel|sol\s+dur|d[eé]solidar|soul[eè]v/.test(ctx)) {
      const piste = top?.label ?? 'Désolidarisation carrelage / sol dur';
      const pct = top ? Math.round(top.score * 100) : 45;
      return {
        key: 'support_sous_carrelage',
        value: `${DOCTRINE_IDENTIFIED_LABEL} — ${piste} (~${pct}%). Typologie Guyane : vérifier vide sanitaire vs dalle pleine au RDC/R+1 ; retenir probabilité modérée sans accès visuel.`,
      };
    }
  }

  if (/permanent|usage|coule|fuite|eau/.test(q) && /eau|fuite|buanderie|plomb/.test(ctx)) {
    return {
      key: 'flux_persistence',
      value: `${DOCTRINE_IDENTIFIED_LABEL} — fuite probablement liée à un équipement (usage) ou défaut d'étanchéité structurelle (permanent) ; prioriser piste AFPOL eau/pathologies.`,
    };
  }

  if (top && pack.structural) {
    return {
      key: 'diagnostic_probable',
      value: `${DOCTRINE_IDENTIFIED_LABEL} — ${top.label}${top.hint ? ` (${top.hint})` : ''} (~${Math.round(top.score * 100)}%).`,
    };
  }

  return null;
}

export function filterQuestionsAntiLoop(
  questions: string[],
  askedHistory: string[],
): string[] {
  return questions.filter((q) => !questionAlreadyAsked(q, askedHistory));
}

/** Parole Lia — diagnostic de probabilité (AFPOL) au lieu de reposer la même question. */
export function buildProbabilisticLiaParole(params: {
  displayName: string;
  contextText: string;
  doctrineVariables: Record<string, string>;
  paulPack: ReturnType<typeof buildPaulAutoCulturePack>;
}): string {
  const name = params.displayName.trim() || 'Marie';
  const doctrineLine = Object.values(params.doctrineVariables)[0];
  const hypos = params.paulPack.hypotheses.slice(0, 2);
  const hypoText = hypos.length
    ? hypos.map((h) => `${h.label} (~${Math.round(h.score * 100)}%)`).join(', ')
    : 'plusieurs causes possibles sur sols tropicaux';

  if (doctrineLine) {
    return (
      `${name}, merci — vous n'avez pas à connaître ces détails techniques. ` +
      `Mon équipe retient : ${doctrineLine.replace(DOCTRINE_IDENTIFIED_LABEL + ' — ', '')}. ` +
      `Prochaine étape : orientation vers le bon métier.`
    ).slice(0, 900);
  }

  return (
    `${name}, je ne vais pas vous reposer la même question. ` +
    `D'après nos fiches AFPOL en Guyane, les pistes les plus probables sont : ${hypoText}. ` +
    `Je transmets au bailleur pour intervention ciblée.`
  ).slice(0, 900);
}

export function applyLiaCultureGarde(params: {
  displayName: string;
  tenantMessage: string;
  tenantParole: string;
  parsed: Record<string, unknown> | null;
  askedQuestions: string[];
  doctrineVariables: Record<string, string>;
  contextText: string;
  lastLiaQuestion?: string;
}): {
  tenantParole: string;
  parsed: Record<string, unknown> | null;
  askedQuestions: string[];
  doctrineVariables: Record<string, string>;
  paulAutoCulture: ReturnType<typeof buildPaulAutoCulturePack>;
} {
  const paulPack = buildPaulAutoCulturePack(params.contextText);
  let asked = [...params.askedQuestions];
  let doctrine = { ...params.doctrineVariables };
  let parsed = params.parsed ? { ...params.parsed } : null;
  let parole = params.tenantParole;

  const questions = parsed
    ? filterQuestionsAntiLoop(extractQuestionsFromParsed(parsed), asked)
    : [];

  if (parsed && questions.length !== extractQuestionsFromParsed(parsed).length) {
    parsed.questions_complement_dessin = questions;
  }

  if (isTenantIgnorance(params.tenantMessage)) {
    const inferred = inferDoctrineVariable({
      contextText: params.contextText,
      lastQuestion: params.lastLiaQuestion ?? asked.at(-1),
    });
    if (inferred) {
      doctrine[inferred.key] = inferred.value;
      if (parsed) {
        parsed.doctrine_variables = doctrine;
        parsed.questions_complement_dessin = [];
      }
      parole = buildProbabilisticLiaParole({
        displayName: params.displayName,
        contextText: params.contextText,
        doctrineVariables: doctrine,
        paulPack,
      });
    }
  } else if (questions.length === 0 && asked.length > 0) {
    parole = buildProbabilisticLiaParole({
      displayName: params.displayName,
      contextText: params.contextText,
      doctrineVariables: doctrine,
      paulPack,
    });
    if (parsed) parsed.questions_complement_dessin = [];
  } else if (questions.length === 1) {
    parole = buildLiaParoleWithSingleQuestion({
      displayName: params.displayName,
      question: questions[0],
      paulPack,
      tenantMessage: params.tenantMessage,
      isFirstTurn: asked.length === 0,
    });
    asked.push(questions[0]);
  }

  if (parsed) {
    parsed.paul_auto_culture = {
      structural: paulPack.structural,
      brief: paulPack.brief.slice(0, 800),
      hypotheses: paulPack.hypotheses.slice(0, 3),
    };
  }

  return {
    tenantParole: parole,
    parsed,
    askedQuestions: asked,
    doctrineVariables: doctrine,
    paulAutoCulture: paulPack,
  };
}

function extractQuestionsFromParsed(parsed: Record<string, unknown>): string[] {
  for (const key of [
    'questions_complement_dessin',
    'questions_complement_demande',
    'questions_complement_demandee',
    'questions_complementaires',
  ]) {
    const raw = parsed[key];
    if (!Array.isArray(raw)) continue;
    const qs = raw.filter((q): q is string => typeof q === 'string' && q.trim().length > 0);
    if (qs.length) return qs;
  }
  return [];
}

function buildLiaParoleWithSingleQuestion(params: {
  displayName: string;
  question: string;
  paulPack: ReturnType<typeof buildPaulAutoCulturePack>;
  tenantMessage: string;
  isFirstTurn: boolean;
}): string {
  const name = params.displayName.trim() || 'Marie';
  const q = params.question.endsWith('?') ? params.question : `${params.question} ?`;

  if (!params.isFirstTurn && !isTenantIgnorance(params.tenantMessage)) {
    return `${name}, merci pour cette précision. ${q}`.slice(0, 900);
  }

  const hint =
    params.paulPack.hypotheses[0] && params.paulPack.structural
      ? ` (${params.paulPack.hypotheses[0].label} — piste AFPOL)`
      : '';

  return `${name}, je visualise la situation${hint}. ${q}`.slice(0, 900);
}

/** Prépare savoir contextualisé pour délibération symbiotique. */
export function prepareDeliberationSavoir(params: {
  title: string;
  description: string;
  message: string;
  existingConsultations?: LivingSavoirConsultation[];
}) {
  return prepareLivingSavoirForDeliberation(params);
}
