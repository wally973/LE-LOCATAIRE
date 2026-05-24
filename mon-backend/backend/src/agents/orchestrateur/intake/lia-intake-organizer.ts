/**
 * Intake piloté par data/panne-diagnostic-logique.json (IA Organisateur).
 */
import type {
  IntakeCategory,
  IntakeSignals,
  LiaIntakeState,
} from './lia-intake.service';
import {
  answerEliminatesCause,
  detectPanneFromText,
  loadPanneDiagnosticCatalog,
  nextOrganizerCause,
} from './panne-diagnostic.loader';
import type { PanneDiagnosticTree } from './panne-diagnostic.types';

export const ORG_QUESTION_PREFIX = 'org:';

export interface LiaIntakeOrganizerState {
  panneId: string;
  eliminatedCauseIds: string[];
  /** Réponses par cause (id cause → texte locataire). */
  causeAnswers: Record<string, string>;
}

export function isOrganizerQuestionId(id: string): boolean {
  return id.startsWith(ORG_QUESTION_PREFIX);
}

export function causeIdFromQuestionId(questionId: string): string {
  return questionId.slice(ORG_QUESTION_PREFIX.length);
}

function isLightingOnlyScopeLocal(
  text: string,
  signals?: IntakeSignals,
  answers?: Record<string, string>,
): boolean {
  if (answers?.scope?.includes('localisé')) return true;
  const t = text.toLowerCase();
  const localized =
    /(lumi[eè]re|ampoule|[eé]clairage|lustre|neon|néon|plafonnier)/.test(t) &&
    !/(toute la maison|tout le logement|plus de courant|plus d['']?[eé]lectri)/.test(
      t,
    );
  const roomLight =
    /salle de bain.*(lumi|ampoule|éclair)|lumi.*salle de bain|cuisine.*(lumi|ampoule)/.test(
      t,
    );
  return localized || roomLight || Boolean(signals?.roomHint);
}

function tenantAlreadyChangedBulbLocal(
  text: string,
  answers?: Record<string, string>,
): boolean {
  if (answers?.bulb_action?.trim()) return true;
  const t = text.toLowerCase();
  return (
    /ampoule/.test(t) &&
    /chang|remplac|essay|neuf|malgr[eé]|d[eé]j[aà]/.test(t)
  );
}

export function getPanneTreeById(panneId: string): PanneDiagnosticTree | null {
  const catalog = loadPanneDiagnosticCatalog();
  return catalog.panes.find((p) => p.id === panneId) ?? null;
}

/** Choisit l'arbre de panne pour ce dossier. */
export function resolveOrganizerPanne(
  category: IntakeCategory,
  title: string,
  description: string,
  signals?: IntakeSignals,
  answers?: Record<string, string>,
): PanneDiagnosticTree | null {
  const full = `${title} ${description}`.trim();
  const detected = detectPanneFromText(full);
  if (detected) return detected;

  const catalog = loadPanneDiagnosticCatalog();
  const byId = (id: string) => catalog.panes.find((p) => p.id === id) ?? null;

  if (category === 'ROOF') {
    return byId('PANNE_INFILTRATION_TOITURE');
  }
  if (category === 'ELECTRICITY') {
    return isLightingOnlyScopeLocal(full, signals, answers)
      ? byId('PANNE_ECLAIRAGE_LOCALISE')
      : byId('PANNE_ELECTRICITE_GENERALE');
  }
  if (category === 'PLUMBING') {
    if (/\bwc\b|toilet|bouch|refoul|évacuation|evacuation/i.test(full)) {
      return byId('PANNE_WC_EVACUATION');
    }
    if (/eau chaude|ballon|chauffe[- ]?eau|douche froide/i.test(full)) {
      return byId('PANNE_EAU_CHAUDE');
    }
    return byId('PANNE_FUITE_EAU_LOCALISEE');
  }
  return null;
}

export function buildOrganizerContext(
  title: string,
  description: string,
  state: LiaIntakeState,
): string {
  return [
    title || state.intakeTitle || '',
    description || state.intakeDescription || '',
    ...Object.values(state.answers),
    ...Object.values(state.organizer?.causeAnswers ?? {}),
    state.signals?.roomHint ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Causes déjà écartées grâce au texte initial ou aux réponses. */
export function prefillEliminatedCauses(
  tree: PanneDiagnosticTree,
  contextText: string,
  answers: Record<string, string>,
): string[] {
  const eliminated: string[] = [];
  const combined = `${contextText} ${Object.values(answers).join(' ')}`;
  for (const cause of tree.causes) {
    if (answerEliminatesCause(combined, cause)) {
      eliminated.push(cause.id);
    }
  }
  return [...new Set(eliminated)];
}

export function nextOrganizerCauseForIntake(
  tree: PanneDiagnosticTree,
  organizer: LiaIntakeOrganizerState,
  contextText: string,
) {
  const excluded = [
    ...organizer.eliminatedCauseIds,
    ...Object.keys(organizer.causeAnswers),
  ];
  return nextOrganizerCause(tree, excluded, contextText);
}

/** Texte de question personnalisé (pièce, sécurité). */
export function formatOrganizerQuestionText(
  tree: PanneDiagnosticTree,
  cause: PanneDiagnosticTree['causes'][0],
  state: LiaIntakeState,
): string {
  let text = cause.discriminantQuestion.text;
  const room = state.signals?.roomHint;
  if (room && /pièce|interrupteur/i.test(text)) {
    text = text.replace(/la pièce/gi, room);
    text = text.replace(/de la pièce/gi, `de ${room}`);
  }
  if (cause.danger.level === 'CRITICAL') {
    text =
      `⚠️ Sécurité : ${cause.danger.description ?? 'prudence requise.'} ` +
      text;
  }
  return text;
}

/** Enregistre la réponse et met à jour les pistes écartées + clés legacy. */
export function applyOrganizerAnswer(
  state: LiaIntakeState,
  questionId: string,
  answer: string,
): LiaIntakeState {
  const tree = state.organizer
    ? getPanneTreeById(state.organizer.panneId)
    : null;
  if (!tree || !state.organizer) return state;

  const causeId = causeIdFromQuestionId(questionId);
  const cause = tree.causes.find((c) => c.id === causeId);
  if (!cause) return state;

  const trimmed = answer.trim();
  const causeAnswers = {
    ...state.organizer.causeAnswers,
    [causeId]: trimmed,
  };
  let eliminatedCauseIds = [...state.organizer.eliminatedCauseIds];
  if (answerEliminatesCause(trimmed, cause)) {
    eliminatedCauseIds.push(causeId);
    eliminatedCauseIds = [...new Set(eliminatedCauseIds)];
  }

  const answers = {
    ...state.answers,
    ...mapCauseAnswerToLegacyKeys(causeId, trimmed, tree.id),
  };

  return {
    ...state,
    answers,
    organizer: {
      ...state.organizer,
      causeAnswers,
      eliminatedCauseIds,
    },
  };
}

/** Compatibilité juriste / électricité existante. */
function mapCauseAnswerToLegacyKeys(
  causeId: string,
  answer: string,
  panneId: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (panneId === 'PANNE_ECLAIRAGE_LOCALISE') {
    if (causeId === 'cause_ampoule_usee') {
      out.bulb_action = answer;
    }
    if (causeId === 'cause_disjoncteur_circuit_declenche') {
      out.room_breaker = answer;
    }
    if (causeId === 'cause_interrupteur_defectueux') {
      out.switch_ok = answer;
    }
    if (causeId === 'cause_douille_support_use') {
      out.socket_check = answer;
    }
  }
  if (panneId === 'PANNE_ELECTRICITE_GENERALE') {
    if (causeId === 'cause_disjoncteur_general') {
      out.breaker = answer;
    }
    if (causeId === 'cause_impayes_abonnement') {
      out.subscription = answer;
    }
  }
  if (panneId === 'PANNE_INFILTRATION_TOITURE') {
    if (causeId === 'cause_toiture_defaut_etancheite') {
      out.when_rains = answer;
    }
  }
  if (panneId === 'PANNE_FUITE_EAU_LOCALISEE') {
    if (causeId === 'cause_siphon_bonde_bouche') {
      out.drain_ok = answer;
    }
    if (causeId === 'cause_robinet_joint_use') {
      out.siphon_action = answer;
    }
  }
  if (panneId === 'PANNE_HUMIDITE_MOISISSURES') {
    if (causeId === 'cause_bricolage_locataire') {
      out.bricolage_attempts = answer;
    }
  }
  return out;
}

/** Après analyse des messages, synchronise pistes écartées et réponses legacy. */
export function syncOrganizerFromContext(
  state: LiaIntakeState,
  title: string,
  description: string,
): LiaIntakeState {
  if (!state.organizer) return state;
  const tree = getPanneTreeById(state.organizer.panneId);
  if (!tree) return state;

  const ctx = buildOrganizerContext(title, description, state);
  let eliminated = prefillEliminatedCauses(tree, ctx, {
    ...state.answers,
    ...state.organizer.causeAnswers,
  });

  const causeAnswers = { ...state.organizer.causeAnswers };
  let answers = { ...state.answers };

  if (
    tree.id === 'PANNE_ECLAIRAGE_LOCALISE' &&
    tenantAlreadyChangedBulbLocal(ctx, answers)
  ) {
    eliminated.push('cause_ampoule_usee');
    if (!causeAnswers.cause_ampoule_usee) {
      const msg =
        answers.bulb_action ??
        'Ampoule déjà remplacée (mentionnée par le locataire).';
      causeAnswers.cause_ampoule_usee = msg;
      answers.bulb_action = msg;
    }
  }

  eliminated = [...new Set(eliminated)];

  return {
    ...state,
    answers,
    organizer: { ...state.organizer, eliminatedCauseIds: eliminated, causeAnswers },
  };
}

export function buildOrganizerIntakeSummaryLines(
  state: LiaIntakeState,
): string[] {
  if (!state.organizer) return [];
  const tree = getPanneTreeById(state.organizer.panneId);
  if (!tree) return [];

  const lines: string[] = [
    `[Parcours organisateur — ${tree.label}]`,
  ];
  for (const cause of tree.causes) {
    const ans = state.organizer.causeAnswers[cause.id];
    if (!ans) continue;
    const status = state.organizer.eliminatedCauseIds.includes(cause.id)
      ? 'piste écartée'
      : 'piste active';
    lines.push(
      `${cause.label} (${status}) — ${cause.discriminantQuestion.text} → ${ans}`,
    );
  }
  return lines;
}
