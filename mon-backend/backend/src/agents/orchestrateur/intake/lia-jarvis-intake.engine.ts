/**
 * Moteur Jarvis — Agent de Raisonnement Systémique (seul pilote dialogue intake).
 * Visualisation 3D + flux (VISUAL_LOGIC) ; panne-diagnostic = KB, pas file de questions.
 */
import { detectMultipleClaims } from '../../chercheur/knowledge/lia-multi-claim';
import {
  buildOrganizerContext,
  getPanneTreeById,
  prefillEliminatedCauses,
  resolveOrganizerPanne,
  syncOrganizerFromContext,
  type LiaIntakeOrganizerState,
} from './lia-intake-organizer';
import type { PanneDiagnosticTree } from './panne-diagnostic.types';
import {
  applyElectricityExtractionToState,
  isElectricityLightingIntakeSaturated,
} from './lia-intake-electricity-extract';
import {
  extractCarpentryIntakeFromText,
  isCarpentryDoorIssueSaturated,
  isCarpentryDoorIssueText,
} from './lia-intake-carpentry-extract';
import {
  extractPlumbingIntakeFromText,
  isPlumbingSinkLeakSaturated,
} from './lia-intake-plumbing-extract';
import type { IntakeCategory, LiaIntakeState } from './lia-intake.service';
import { ORG_QUESTION_PREFIX } from './lia-intake-organizer';
import { detectLanguageFromTenantText } from '../../shared/lia-tenant-language';

export type JarvisDialogueIntent =
  | 'greeting'
  | 'reassurance'
  | 'meta_question'
  | 'topic_change_candidate'
  | 'fact';

const CONTESTATION_RE =
  /pourquoi|de quoi|ne comprend|pas normal|bien compris|comprenez|vous (avez|me) (parle|demande)|je (viens de|vous) (dir|dit)|concentrons|plut[oô]t|r[aâ]ler|inutile|absurde/i;

const META_QUESTION_RE =
  /peux[- ]?tu lire|as[- ]?tu (lu|re[cç]u)|avez[- ]?vous (bien )?(compris|sa)|mon (message|signalement|r[eé]clamation)/i;

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Message de contestation ou réassurance — pas un changement de sujet. */
export function isContestationOrReassurance(message: string): boolean {
  const t = norm(message);
  return CONTESTATION_RE.test(t) || META_QUESTION_RE.test(t);
}

export function detectJarvisDialogueIntent(
  message: string,
  ticketTitle: string,
  ticketDescription: string,
): JarvisDialogueIntent {
  const msg = message.trim();
  if (!msg) return 'fact';
  if (META_QUESTION_RE.test(msg)) return 'meta_question';
  if (CONTESTATION_RE.test(msg)) return 'reassurance';
  if (isConfirmedTopicChange(msg, ticketTitle, ticketDescription, null)) {
    return 'topic_change_candidate';
  }
  return 'fact';
}

/**
 * Changement de sujet réel — pas quand le locataire cite « toiture » pour protester.
 */
export function isConfirmedTopicChange(
  message: string,
  ticketTitle: string,
  ticketDescription: string,
  ticketCategory: IntakeCategory | null,
): boolean {
  if (isContestationOrReassurance(message)) {
    return false;
  }

  const ticketCtx = norm(`${ticketTitle} ${ticketDescription}`);
  const msgNorm = norm(message);

  const reaffirmsTicket =
    ticketCategory === 'PLUMBING'
      ? /evier|évier|lavabo|fuite|plomb|robinet|siphon/.test(msgNorm) &&
        /evier|évier|fuite|plomb/.test(ticketCtx)
      : ticketCategory === 'ELECTRICITY'
        ? /lumi|ampoule|éclair|interrupteur|disjoncteur|compteur/.test(
            msgNorm,
          )
        : ticketCategory === 'ROOF'
          ? /toit|toiture|infiltr|pluie|plafond/.test(msgNorm)
          : false;

  if (reaffirmsTicket) {
    return false;
  }

  const msgClaims = detectMultipleClaims(message, message);
  if (msgClaims.length === 0) return false;
  if (msgClaims.length > 1) {
    return !msgClaims.some((c) => c.category === ticketCategory);
  }

  const ticketClaims = detectMultipleClaims(ticketTitle, ticketDescription);
  const ticketCat =
    ticketCategory ?? ticketClaims[0]?.category ?? null;
  if (!ticketCat) return msgClaims.length > 0;

  return msgClaims[0].category !== ticketCat;
}

/** Extraction 360° sur tout le contexte cumulé. */
export function applyJarvis360ToState(
  state: LiaIntakeState,
  title: string,
  description: string,
  message = '',
): LiaIntakeState {
  const lang = message.trim()
    ? detectLanguageFromTenantText(
        message,
        title,
        description,
        state.intakeTitle,
        state.intakeDescription,
      )
    : detectLanguageFromTenantText(
        title,
        description,
        state.intakeTitle,
        state.intakeDescription,
      );
  let next: LiaIntakeState = {
    ...state,
    intakeMode: 'jarvis',
    preferredLanguage: lang,
    jarvisFacts: { ...(state.jarvisFacts ?? {}) },
  };

  if (state.category === 'ELECTRICITY') {
    next = applyElectricityExtractionToState(next, title, description, message);
  }

  if (state.category === 'PLUMBING') {
    const pl = extractPlumbingIntakeFromText(title, description, message);
    next = {
      ...next,
      answers: { ...next.answers, ...pl.answers },
      skippedQuestionIds: [
        ...new Set([
          ...(next.skippedQuestionIds ?? []),
          ...pl.skippedQuestionIds,
        ]),
      ],
      jarvisFacts: { ...next.jarvisFacts, ...pl.jarvisFacts },
      signals: pl.roomHint
        ? { ...next.signals, roomHint: pl.roomHint }
        : next.signals,
    };
  }

  const carpCtx = `${title} ${description} ${message}`;
  if (isCarpentryDoorIssueText(carpCtx)) {
    const carp = extractCarpentryIntakeFromText(title, description, message);
    next = {
      ...next,
      answers: { ...next.answers, ...carp.answers },
      skippedQuestionIds: [
        ...new Set([
          ...(next.skippedQuestionIds ?? []),
          ...carp.skippedQuestionIds,
        ]),
      ],
      jarvisFacts: { ...next.jarvisFacts, ...carp.jarvisFacts },
      signals: carp.roomHint
        ? { ...next.signals, roomHint: carp.roomHint }
        : next.signals,
    };
  }

  next = syncOrganizerFromContext(next, title, description);
  return next;
}

/** Cause non pertinente grâce au contexte déjà acquis (KB, pas ordre script). */
function shouldSkipCauseByContext(
  causeId: string,
  contextText: string,
  category: IntakeCategory,
): boolean {
  const t = norm(contextText);

  if (
    causeId === 'cause_colonne_collective' &&
    /sous.*(evier|évier)|fuite.*(dessous|sous|endessous)|dessous.*(evier|évier)|(evier|évier).*(fuit|coule)/.test(
      t,
    )
  ) {
    return true;
  }

  if (
    (causeId === 'cause_toiture_defaut_etancheite' ||
      causeId.includes('toiture')) &&
    category === 'PLUMBING' &&
    !/plafond|toit|infiltr|goutti/.test(t)
  ) {
    return true;
  }

  if (
    causeId === 'cause_ampoule_usee' &&
    /ampoule.*(chang|remplac|deja|déjà)|deja chang.*ampoule/.test(t)
  ) {
    return true;
  }

  return false;
}

function scoreCausePriority(
  cause: PanneDiagnosticTree['causes'][0],
  contextText: string,
): number {
  let score = cause.probabilityGuyane ?? 0.3;
  const dangerBoost: Record<string, number> = {
    CRITICAL: 100,
    HIGH: 50,
    MEDIUM: 10,
    LOW: 0,
  };
  score += dangerBoost[cause.danger.level] ?? 0;
  const t = norm(contextText);
  for (const kw of cause.label.split(/\s+/)) {
    if (kw.length > 4 && t.includes(norm(kw))) score += 5;
  }
  return score;
}

/**
 * Choisit UNE question critique manquante (consulte la KB, ignore l’ordre du JSON).
 */
export function pickJarvisCriticalQuestion(
  state: LiaIntakeState,
): { id: string; text: string; causeId: string } | null {
  if (state.phase !== 'INTAKE' || !state.organizer) {
    return null;
  }

  const tree = getPanneTreeById(state.organizer.panneId);
  if (!tree) return null;

  const ctx = buildOrganizerContext(
    state.intakeTitle ?? '',
    state.intakeDescription ?? '',
    state,
  );
  const ctxFull = `${ctx} ${Object.values(state.jarvisFacts ?? {}).join(' ')}`;

  const eliminated = new Set([
    ...state.organizer.eliminatedCauseIds,
    ...prefillEliminatedCauses(tree, ctxFull, state.answers),
  ]);

  const candidates = tree.causes.filter((cause) => {
    if (eliminated.has(cause.id)) return false;
    if (state.organizer!.causeAnswers[cause.id]?.trim()) return false;
    if (shouldSkipCauseByContext(cause.id, ctxFull, state.category)) return false;
    if (state.skippedQuestionIds?.includes(`${ORG_QUESTION_PREFIX}${cause.id}`)) {
      return false;
    }
    return true;
  });

  if (!candidates.length) return null;

  candidates.sort(
    (a, b) => scoreCausePriority(b, ctxFull) - scoreCausePriority(a, ctxFull),
  );

  const cause = candidates[0];
  let text = cause.discriminantQuestion.text;
  const room = state.signals?.roomHint;
  if (room && /pièce|interrupteur|évier|lavabo/i.test(text)) {
    text = text.replace(/la pièce/gi, room);
    text = text.replace(/de la pièce/gi, `de ${room}`);
  }
  if (cause.danger.level === 'CRITICAL') {
    text = `Pour votre sécurité : ${cause.danger.description ?? 'prudence.'} ${text}`;
  }

  return {
    id: `${ORG_QUESTION_PREFIX}${cause.id}`,
    text,
    causeId: cause.id,
  };
}

export function isJarvisReadyForImmediateVerdict(state: LiaIntakeState): boolean {
  if (state.category === 'ELECTRICITY') {
    return isElectricityLightingIntakeSaturated(state);
  }
  if (state.category === 'PLUMBING') {
    return isPlumbingSinkLeakSaturated(state);
  }
  if (isCarpentryDoorIssueSaturated(state)) {
    return true;
  }

  if (!state.organizer) return false;
  const tree = getPanneTreeById(state.organizer.panneId);
  if (!tree) return false;

  const q = pickJarvisCriticalQuestion(state);
  return q === null;
}

export function buildJarvisReassurance(params: {
  message: string;
  state: LiaIntakeState;
  tenantFirstName?: string;
}): string {
  const name = params.tenantFirstName?.trim() || 'Bonjour';
  const t = norm(params.message);

  if (
    params.state.category === 'PLUMBING' &&
    (/toiture|plafond|colonne/.test(t) || /pourquoi/.test(t))
  ) {
    return (
      `${name}, vous avez raison — excusez-moi pour la confusion. ` +
      'Je vérifiais au cas où l’eau viendrait d’une colonne ou du plafond, mais vous avez bien précisé une fuite sous l’évier. ' +
      'On se concentre uniquement sur votre évier : je garde le reste de côté.'
    );
  }

  if (params.state.category === 'ELECTRICITY' && /toiture|plafond|disjoncteur/.test(t)) {
    return (
      `${name}, pardon si la question semblait hors sujet. ` +
      'Je croise plusieurs causes possibles, mais je retiens bien votre éclairage et ce que vous avez déjà vérifié.'
    );
  }

  if (
    isCarpentryDoorIssueSaturated({
      ...params.state,
      intakeTitle: params.state.intakeTitle,
      intakeDescription: params.state.intakeDescription,
    })
  ) {
  const ex = extractCarpentryIntakeFromText(
    params.state.intakeTitle ?? '',
    params.state.intakeDescription ?? '',
    params.message,
  );
  const facts = { ...params.state.jarvisFacts, ...ex.jarvisFacts };
  const element = facts.element ?? 'la gâche / serrure';
  const lieu = facts.localisation ?? 'la pièce indiquée';
    return (
      `${name}, oui — j’ai bien compris : ${element.toLowerCase()} ` +
      `(${lieu}) est cassée. Je ne vous redemande pas ce que vous avez déjà précisé. ` +
      'Je transmets au bailleur pour qu’un serrurier intervienne.'
    );
  }

  if (META_QUESTION_RE.test(params.message)) {
    return (
      `${name}, oui — j’ai bien lu votre signalement initial et vos réponses. ` +
      'Je visualise le logement (réseaux d’eau, enveloppe du bâtiment, confort) à partir de ce que vous avez déjà écrit — pas besoin de répéter.'
    );
  }

  const viz = params.state.jarvisFacts?.visualization;
  if (viz) {
    return (
      `${name}, excusez-moi pour la confusion. ` +
      `Je m’étais appuyée sur cette visualisation : ${viz}. ` +
      'Je reprends uniquement votre signalement initial, sans vous faire répéter.'
    );
  }

  return (
    `${name}, excusez-moi si ma question semblait hors sujet. ` +
    'Je simule les flux dans le logement (eau, air, électricité) pour cibler la bonne cause — ' +
    'je reprends votre dossier avec ce que vous venez de préciser.'
  );
}

export function buildTopicChangeConfirmationQuestion(
  detectedLabel: string,
): string {
  return (
    `Vous évoquez aussi « ${detectedLabel} ». ` +
    'Souhaitez-vous vraiment ouvrir une nouvelle demande pour ce second sujet ? ' +
    'Répondez oui pour une nouvelle réclamation, ou non pour continuer sur le dossier actuel.'
  );
}

export function parseTopicChangeConfirmation(
  message: string,
): 'yes' | 'no' | null {
  const t = norm(message);
  if (/\b(oui|yes|ok pour|nouvelle (demande|réclamation)|autre sujet)\b/.test(t)) {
    return 'yes';
  }
  if (/\b(non|pas pour|continue|même dossier|ce dossier)\b/.test(t)) {
    return 'no';
  }
  return null;
}

export function detectedTopicLabelForConfirmation(
  message: string,
  ticketCategory: IntakeCategory | null,
): string | null {
  const claims = detectMultipleClaims(message, message);
  const other = claims.find((c) => c.category !== ticketCategory);
  return other?.label ?? claims[0]?.label ?? null;
}

export function ensureJarvisOrganizer(
  state: LiaIntakeState,
  title: string,
  description: string,
): LiaIntakeState {
  if (state.organizer) {
    return applyJarvis360ToState(state, title, description);
  }

  const tree = resolveOrganizerPanne(
    state.category,
    title,
    description,
    state.signals,
    state.answers,
  );
  if (!tree) {
    return applyJarvis360ToState(state, title, description);
  }

  const fullText = `${title} ${description}`;
  const organizer: LiaIntakeOrganizerState = {
    panneId: tree.id,
    eliminatedCauseIds: prefillEliminatedCauses(tree, fullText, state.answers),
    causeAnswers: {},
  };

  return applyJarvis360ToState(
    { ...state, organizer },
    title,
    description,
  );
}
