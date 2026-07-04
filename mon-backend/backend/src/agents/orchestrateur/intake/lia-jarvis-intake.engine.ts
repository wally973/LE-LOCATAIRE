/**
 * Moteur Jarvis — extraction 360° et intents dialogue (sans arbre de questions).
 */
import { detectMultipleClaims } from '../../chercheur/knowledge/lia-multi-claim';
import {
  extractCarpentryIntakeFromText,
  isCarpentryDoorIssueSaturated,
} from './lia-intake-carpentry-extract';
import type { IntakeCategory, LiaIntakeState } from './lia-intake.service';
import { resolveLanguageForIntake } from '../../shared/lia-dialogue-languages';

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
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function isContestationOrReassurance(message: string): boolean {
  const t = norm(message);
  return CONTESTATION_RE.test(t) || META_QUESTION_RE.test(t);
}

export function detectJarvisDialogueIntent(
  message: string,
  ticketTitle: string,
  ticketDescription: string,
  ticketCategory: IntakeCategory | null = null,
): JarvisDialogueIntent {
  const msg = message.trim();
  if (!msg) return 'fact';
  if (META_QUESTION_RE.test(msg)) return 'meta_question';
  if (CONTESTATION_RE.test(msg)) return 'reassurance';
  if (isConfirmedTopicChange(msg, ticketTitle, ticketDescription, ticketCategory)) {
    return 'topic_change_candidate';
  }
  return 'fact';
}

export function isConfirmedTopicChange(
  message: string,
  ticketTitle: string,
  ticketDescription: string,
  ticketCategory: IntakeCategory | null,
): boolean {
  if (isContestationOrReassurance(message)) return false;

  const ticketCtx = norm(`${ticketTitle} ${ticketDescription}`);
  const msgNorm = norm(message);

  const reaffirmsTicket =
    ticketCategory === 'PLUMBING'
      ? /evier|évier|lavabo|fuite|plomb|robinet|siphon/.test(msgNorm) &&
        /evier|évier|fuite|plomb/.test(ticketCtx)
      : ticketCategory === 'ELECTRICITY'
        ? /lumi|ampoule|éclair|interrupteur|disjoncteur|compteur|prise/.test(msgNorm)
        : ticketCategory === 'ROOF'
          ? /toit|toiture|infiltr|pluie|plafond/.test(msgNorm)
          : false;

  if (reaffirmsTicket) return false;

  const msgClaims = detectMultipleClaims(message, message);
  if (msgClaims.length === 0) return false;
  if (msgClaims.length > 1) {
    return !msgClaims.some((c) => c.category === ticketCategory);
  }

  const ticketClaims = detectMultipleClaims(ticketTitle, ticketDescription);
  const ticketCat = ticketCategory ?? ticketClaims[0]?.category ?? null;
  if (!ticketCat) return msgClaims.length > 0;

  return msgClaims[0].category !== ticketCat;
}

/** Tabula Rasa — langue uniquement, sans extraction métier imposée. */
export function applyJarvisLanguageToState(
  state: LiaIntakeState,
  title: string,
  description: string,
  message = '',
): LiaIntakeState {
  const lang = message.trim()
    ? resolveLanguageForIntake(
        state,
        message,
        title,
        description,
        state.intakeTitle,
        state.intakeDescription,
      )
    : resolveLanguageForIntake(
        state,
        title,
        description,
        state.intakeTitle,
        state.intakeDescription,
      );
  return {
    ...state,
    intakeMode: 'jarvis',
    preferredLanguage: lang,
    jarvisFacts: { ...(state.jarvisFacts ?? {}) },
  };
}

/** @deprecated Tabula Rasa — alias langue uniquement. */
export function applyJarvis360ToState(
  state: LiaIntakeState,
  title: string,
  description: string,
  message = '',
): LiaIntakeState {
  return applyJarvisLanguageToState(state, title, description, message);
}

/** @deprecated Living Intelligence — plus de questions scriptées. */
export function pickJarvisCriticalQuestion(
  _state: LiaIntakeState,
): null {
  return null;
}

export function isJarvisReadyForImmediateVerdict(state: LiaIntakeState): boolean {
  return (
    state.intakeMode === 'jarvis' &&
    (state.answers.jarvis_intake_complete === 'oui' || state.phase === 'DONE')
  );
}

export function buildJarvisReassurance(params: {
  message: string;
  state: LiaIntakeState;
  tenantFirstName?: string;
}): string {
  const name = params.tenantFirstName?.trim() || 'Marie';
  const t = norm(params.message);

  if (META_QUESTION_RE.test(params.message)) {
    return (
      `${name}, oui — j’ai bien lu votre signalement et vos réponses. ` +
      'Je visualise le logement à partir de ce que vous avez déjà écrit — pas besoin de répéter.'
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
    const element = facts.element ?? 'la serrure';
    return `${name}, j’ai bien compris pour ${element.toLowerCase()} — je ne vous fais pas répéter.`;
  }

  if (/pourquoi|pas normal|comprenez/.test(t)) {
    return (
      `${name}, excusez-moi si ma réponse semblait hors sujet. ` +
      'Je reprends votre dossier avec ce que vous venez de préciser.'
    );
  }

  return `${name}, je vous entends — je reste avec vous sur ce dossier.`;
}

export function buildTopicChangeConfirmationQuestion(
  detectedLabel: string,
): string {
  return (
    `Vous évoquez aussi « ${detectedLabel} ». ` +
    'Souhaitez-vous ouvrir une nouvelle demande pour ce second sujet ? ' +
    'Répondez oui ou non.'
  );
}

export function parseTopicChangeConfirmation(
  message: string,
): 'yes' | 'no' | null {
  const t = norm(message);
  if (/\b(oui|yes|ok pour|nouvelle (demande|réclamation))\b/.test(t)) return 'yes';
  if (/\b(non|pas pour|continue|même dossier)\b/.test(t)) return 'no';
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

/** Bootstrap — langue uniquement (Tabula Rasa). */
export function ensureJarvisOrganizer(
  state: LiaIntakeState,
  title: string,
  description: string,
): LiaIntakeState {
  return applyJarvisLanguageToState(state, title, description);
}
