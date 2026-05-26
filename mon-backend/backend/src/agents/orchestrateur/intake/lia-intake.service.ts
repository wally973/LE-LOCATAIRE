import { Injectable } from '@nestjs/common';
import type { CompanionUiState } from '../conversation/lia-companion.types';
import { buildElectricityJuristHint } from '../../diagnostiqueur/rules/lia-electricity-rules';
import type { LiaIntakeOrganizerState } from './lia-intake-organizer';
import {
  applyOrganizerAnswer,
  buildOrganizerContext,
  buildOrganizerIntakeSummaryLines,
  formatOrganizerQuestionText,
  getPanneTreeById,
  isOrganizerQuestionId,
  nextOrganizerCauseForIntake,
  ORG_QUESTION_PREFIX,
  prefillEliminatedCauses,
  resolveOrganizerPanne,
} from './lia-intake-organizer';
import {
  extractDiagnosticSensors,
  isWaterOnFloorReport,
} from '../../shared/lia-diagnostic-sensors';
import { getMissingCriticalSensors } from '../../shared/critical-diagnostic-sensors';
import {
  extractElectricityIntakeFromText,
  isElectricityLightingIntakeSaturated,
  needsContextualElectricityPhoto,
} from './lia-intake-electricity-extract';
import {
  ensureJarvisOrganizer,
  isJarvisReadyForImmediateVerdict,
  pickJarvisCriticalQuestion,
} from './lia-jarvis-intake.engine';
import { isPlumbingSinkLeakSaturated } from './lia-intake-plumbing-extract';
import {
  INTAKE_LANGUAGE_ANSWER_ID,
  isTenantLanguageGreeting,
  resolveLanguageFromGreeting,
} from '../../shared/lia-tenant-greeting';
export type { LiaIntakeOrganizerState } from './lia-intake-organizer';

/** Catégories dérivées du libellé initial (ex. PDF conversation). */
export type IntakeCategory = 'PLUMBING' | 'ROOF' | 'ELECTRICITY' | 'GENERIC';

export type IntakePhase = 'INTAKE' | 'AWAITING_PHOTO' | 'DONE';

export interface IntakeQuestion {
  id: string;
  text: string;
}

/** Indices extraits de la première phrase du locataire. */
export interface IntakeSignals {
  rainingNow?: boolean;
  roofLeak?: boolean;
  roomHint?: string;
  situationPresent?: boolean;
  /** Toiture / infiltration → en principe charge bailleur. */
  landlordLikely?: boolean;
}

export interface LiaIntakeState {
  phase: IntakePhase;
  category: IntakeCategory;
  stepIndex: number;
  answers: Record<string, string>;
  signals?: IntakeSignals;
  /** Questions non pertinentes après analyse des réponses (intake réactif). */
  skippedQuestionIds?: string[];
  /** Parcours questions depuis panne-diagnostic-logique.json. */
  organizer?: LiaIntakeOrganizerState;
  intakeTitle?: string;
  intakeDescription?: string;
  /** Langue choisie via salutation (Bonjou → gcf). */
  preferredLanguage?: string;
  /** llm_first = compréhension naturelle (défaut) ; jarvis/legacy = anciens modes. */
  intakeMode?: 'llm_first' | 'jarvis' | 'legacy';
  /** Faits extraits à 360° (non redemandés au locataire). */
  jarvisFacts?: Record<string, string>;
  /** Changement de sujet suspect — confirmation explicite requise avant fermeture. */
  topicChangePending?: boolean;
  pendingTopicLabel?: string;
}

export interface IntakeReactiveTurn {
  state: LiaIntakeState;
  /** Reformulation / prise en compte de ce que le locataire vient de dire. */
  acknowledgment: string | null;
  /** Prochaine question à poser, ou null si photo / analyse. */
  nextQuestionText: string | null;
  /** Statut affiché sous ce message Lia (synchronisé avec la parole). */
  uiStatus?: import('../conversation/lia-message-ui-status').LiaMessageUiStatus;
}

export const INTAKE_QUESTIONS: Record<IntakeCategory, IntakeQuestion[]> = {
  PLUMBING: [
    {
      id: 'since_when',
      text: 'Depuis quand avez-vous constaté le problème ?',
    },
    {
      id: 'siphon_action',
      text:
        'Avez-vous nettoyé le siphon ou utilisé un produit pour déboucher ? (répondez oui/non et précisez)',
    },
    {
      id: 'drain_ok',
      text: "L'eau s'écoule-t-elle normalement du lavabo ou de l'évier ?",
    },
  ],
  ROOF: [
    {
      id: 'since_when',
      text: 'Depuis quand avez-vous constaté la fuite ?',
    },
    {
      id: 'when_rains',
      text: 'La fuite apparaît-elle surtout quand il pleut ?',
    },
    {
      id: 'protect_belongings',
      text: 'Avez-vous pu protéger vos effets personnels ?',
    },
  ],
  ELECTRICITY: [
    {
      id: 'since_when',
      text: 'Depuis quand n’avez-vous plus d’électricité (ou plus de courant) ?',
    },
    {
      id: 'breaker',
      text: 'Avez-vous débranché les appareils et remis le disjoncteur ?',
    },
    {
      id: 'breaker_stays',
      text: 'Le disjoncteur reste-t-il enclenché ?',
    },
    {
      id: 'subscription',
      text: 'Êtes-vous à jour de votre abonnement auprès de votre fournisseur d’électricité ?',
    },
  ],
  GENERIC: [
    {
      id: 'since_when',
      text: 'Depuis quand avez-vous constaté le problème ?',
    },
    {
      id: 'location_detail',
      text: 'Où exactement se situe le problème dans le logement ?',
    },
    {
      id: 'worsening',
      text: 'Le problème s’aggrave-t-il avec le temps ?',
    },
  ],
};

/**
 * Eau au sol (flaque, nappe) — l’organisateur doit qualifier aspect et horaires
 * (Golden REF_EAU_SAVONNEUSE).
 */
export const INTAKE_WATER_ON_FLOOR: IntakeQuestion[] = [
  {
    id: 'water_aspect',
    text:
      'L’eau au sol est-elle plutôt claire, trouble, ou mousseuse / savonneuse ? (décrivez en une phrase)',
  },
  {
    id: 'timing_pattern',
    text:
      'Cette eau apparaît-elle à des heures précises (par ex. le soir entre 19 h et 21 h) ? Si oui, indiquez le créneau.',
  },
  {
    id: 'building_floor',
    text: 'À quel étage êtes-vous dans l’immeuble ? (RDC, R+1, R+2…)',
  },
  {
    id: 'weather_context',
    text:
      'En ce moment, pleut-il souvent chez vous ou êtes-vous en saison sèche (peu ou pas de pluie) ?',
  },
];

/** Éclairage localisé : ampoule déjà testée → interrupteur, disjoncteur pièce, douille. */
export const INTAKE_LIGHTING_ELECTRICITY: IntakeQuestion[] = [
  {
    id: 'since_when',
    text: 'Depuis quand cet éclairage ne fonctionne-t-il plus ?',
  },
  {
    id: 'switch_ok',
    text:
      'L’interrupteur de la pièce fonctionne-t-il (avez-vous essayé marche et arrêt) ?',
  },
  {
    id: 'room_breaker',
    text:
      'Avez-vous vérifié au tableau si le disjoncteur de ce circuit est bien enclenché (remis en position si besoin) ?',
  },
  {
    id: 'socket_check',
    text:
      'La douille / le support de l’ampoule présente-t-il un signe d’usure (brunissement, jeu, odeur) ?',
  },
];

/** Contexte intake stocké dans Ticket.aiLastDecision.intake */
export function parseIntakeState(
  aiLastDecision: unknown,
): LiaIntakeState | null {
  if (!aiLastDecision || typeof aiLastDecision !== 'object') return null;
  const raw = (aiLastDecision as { intake?: LiaIntakeState }).intake;
  if (!raw || raw.phase == null) return null;
  return raw;
}

export function buildIntakePayload(
  state: LiaIntakeState,
  companion?: CompanionUiState,
): Record<string, unknown> {
  return companion ? { intake: state, companion } : { intake: state };
}

/** Fusionne des champs dans aiLastDecision sans perdre intake / companion. */
export function mergeAiLastDecision(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    current && typeof current === 'object'
      ? { ...(current as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

/** Dossier clos : plus de messages ni de ré-analyse sur ce fil (nouvelle demande ailleurs). */
export function isFollowUpClosed(aiLastDecision: unknown): boolean {
  if (!aiLastDecision || typeof aiLastDecision !== 'object') return false;
  return (aiLastDecision as { followUpClosed?: boolean }).followUpClosed === true;
}

/** Parcours « eau au sol » (aspect + horaires + étage + météo). */
export function usesWaterOnFloorPath(state: LiaIntakeState): boolean {
  return isWaterOnFloorReport(
    state.intakeTitle ?? '',
    state.intakeDescription ?? '',
    state.answers,
  );
}

/** Liste de questions active pour cet intake (général vs éclairage localisé). */
export function getIntakeQuestionsForState(
  state: LiaIntakeState,
): IntakeQuestion[] {
  if (usesLightingElectricityPath(state)) {
    return INTAKE_LIGHTING_ELECTRICITY;
  }
  if (usesWaterOnFloorPath(state)) {
    const waterIds = new Set(INTAKE_WATER_ON_FLOOR.map((q) => q.id));
    const base = INTAKE_QUESTIONS[state.category].filter(
      (q) =>
        !waterIds.has(q.id) &&
        !(state.category === 'PLUMBING' && /siphon|ecoule/i.test(q.text)),
    );
    return [...INTAKE_WATER_ON_FLOOR, ...base];
  }
  return INTAKE_QUESTIONS[state.category];
}

export function usesLightingElectricityPath(state: LiaIntakeState): boolean {
  if (state.category !== 'ELECTRICITY') return false;
  const ctx = [
    ...Object.values(state.answers),
    state.signals?.roomHint ?? '',
  ].join(' ');
  return isLightingOnlyScope(ctx, state.signals, state.answers);
}

export function isLightingOnlyScope(
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
    ) &&
    !/(disjoncteur|compteur|tableau).*(g[eé]n[eé]ral|tout)/.test(t);
  const roomLight =
    /salle de bain.*(lumi|ampoule|éclair)|lumi.*salle de bain|cuisine.*(lumi|ampoule)|chambre.*(sans lumi|pas de lumi|ne marche pas)|pas de lumi.*chambre/.test(
      t,
    );
  return localized || roomLight;
}

export function tenantAlreadyChangedBulb(
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

/** Résumé textuel pour le pathologiste / juriste (après les questions). */
export function buildIntakeSummary(state: LiaIntakeState): string {
  const organizerLines = buildOrganizerIntakeSummaryLines(state);
  const questions = state.organizer ? [] : getIntakeQuestionsForState(state);
  const lines = questions
    .map((q) => {
      const a = state.answers[q.id];
      return a ? `${q.text} → ${a}` : null;
    })
    .filter((x): x is string => x != null);
  if (state.answers.bulb_action) {
    lines.push(
      `Ampoule — le locataire a déjà changé l’ampoule → ${state.answers.bulb_action}`,
    );
  }
  if (state.answers.scope) {
    lines.push(`Périmètre → ${state.answers.scope}`);
  }
  const signalLines: string[] = [];
  if (state.signals?.rainingNow) {
    signalLines.push('Situation : il pleut / intempéries au moment du signalement.');
  }
  if (state.signals?.roomHint) {
    signalLines.push(`Pièce concernée (détectée) : ${state.signals.roomHint}.`);
  }
  if (state.signals?.landlordLikely) {
    signalLines.push(
      'Orientation métier : infiltration / toiture → charge bailleur probable.',
    );
  }
  if (state.category === 'ELECTRICITY' && usesLightingElectricityPath(state)) {
    const hint = buildElectricityJuristHint(state.answers);
    if (hint) signalLines.push(hint);
  }
  if (usesWaterOnFloorPath(state)) {
    const sensors = extractDiagnosticSensors({
      contextText: [
        state.intakeTitle ?? '',
        state.intakeDescription ?? '',
        ...Object.values(state.answers),
      ].join('\n'),
      intakeAnswers: state.answers,
    });
    if (sensors.water_aspect) {
      signalLines.push(`Aspect de l’eau (capteur) : ${sensors.water_aspect}.`);
    }
    if (sensors.timing_pattern) {
      signalLines.push(`Horaire d’apparition (capteur) : ${sensors.timing_pattern}.`);
    }
    if (sensors.building_floor) {
      signalLines.push(`Étage (capteur) : ${sensors.building_floor}.`);
    }
    if (sensors.weather_context) {
      signalLines.push(`Contexte météo (capteur) : ${sensors.weather_context}.`);
    }
  }
  return [
    '[Contexte recueilli avec Lia avant diagnostic]',
    ...signalLines,
    ...organizerLines,
    ...lines,
  ].join('\n');
}

/** Enrichit le feedback locataire avec le contexte intake (photo ou analyse). */
export function appendIntakeContextToFeedback(
  aiLastDecision: unknown,
  feedback?: string,
): string | undefined {
  const intake = parseIntakeState(aiLastDecision);
  if (!intake || intake.phase === 'INTAKE') {
    return feedback?.trim() || undefined;
  }
  const summary = buildIntakeSummary(intake);
  const parts = [summary, feedback?.trim()].filter((p) => p && p.length > 0);
  return parts.length ? parts.join('\n\n') : undefined;
}

@Injectable()
export class LiaIntakeService {
  detectCategory(title: string, description: string): IntakeCategory {
    const t = `${title} ${description}`.toLowerCase();
    if (
      /toiture|toit|pluie|gouttière|gouttiere|infiltration/.test(t)
    ) {
      return 'ROOF';
    }
    if (
      /électri|electri|disjoncteur|compteur|courant|prise|panne|ampoule|lumi[eè]re|[eé]clairage|interrupteur/.test(
        t,
      )
    ) {
      return 'ELECTRICITY';
    }
    if (
      /fuite|évier|evier|lavabo|siphon|plomb|robinet|canalis|eau/.test(t)
    ) {
      return 'PLUMBING';
    }
    return 'GENERIC';
  }

  createInitialState(title: string, description: string): LiaIntakeState {
    const category = this.detectCategory(title, description);
    let signals = this.extractSignals(`${title} ${description}`);
    let answers = this.prefillAnswersFromInitialText(
      category,
      signals,
      title,
      description,
    );
    const fullText = `${title} ${description}`;
    let skippedFromExtract: string[] | undefined;
    let jarvisFactsFromExtract: Record<string, string> | undefined;
    if (category === 'ELECTRICITY') {
      const extracted = extractElectricityIntakeFromText(title, description);
      answers = { ...answers, ...extracted.answers };
      skippedFromExtract = extracted.skippedQuestionIds;
      if (extracted.roomHint) {
        signals = { ...signals, roomHint: extracted.roomHint };
      }
    }
    // Mode llm_first : pas d’extraction scriptée par métier à l’ouverture.
    const waterFloor = isWaterOnFloorReport(title, description, answers);
    const tree = waterFloor
      ? undefined
      : resolveOrganizerPanne(
          category,
          title,
          description,
          signals,
          answers,
        );
    const organizer = tree
      ? {
          panneId: tree.id,
          eliminatedCauseIds: prefillEliminatedCauses(
            tree,
            fullText,
            answers,
          ),
          causeAnswers: {} as Record<string, string>,
        }
      : undefined;

    const base: LiaIntakeState = {
      phase: 'INTAKE',
      category,
      stepIndex: 0,
      answers,
      signals,
      intakeTitle: title,
      intakeDescription: description,
      organizer,
      intakeMode: 'llm_first',
      jarvisFacts: jarvisFactsFromExtract ?? {},
      skippedQuestionIds: [
        ...this.allScriptQuestionIds(category),
        ...(organizer ? this.legacyQuestionIdsForCategory(category) : []),
        ...(skippedFromExtract ?? []),
      ],
    };
    // LLM-first : pas d’organisateur scripté à l’ouverture ; le modèle mène le dialogue.
    if (base.intakeMode === 'llm_first') {
      return {
        ...base,
        organizer: undefined,
        phase: 'INTAKE',
        stepIndex: 0,
      };
    }
    let jarvisState = ensureJarvisOrganizer(base, title, description);
    if (
      isJarvisReadyForImmediateVerdict(jarvisState) &&
      !this.needsPhoto(jarvisState)
    ) {
      jarvisState = { ...jarvisState, phase: 'DONE', stepIndex: 0 };
    }
    return this.reconcileStepIndex(jarvisState);
  }

  /** Toutes les questions fixes d'une catégorie (désactivées si parcours organisateur). */
  private legacyQuestionIdsForCategory(category: IntakeCategory): string[] {
    const ids = INTAKE_QUESTIONS[category].map((q) => q.id);
    if (category === 'ELECTRICITY') {
      return [...ids, ...INTAKE_LIGHTING_ELECTRICITY.map((q) => q.id)];
    }
    return ids;
  }

  /** Analyse la phrase initiale et produit les messages Lia (situation → conseils). */
  buildSituationAnalysisMessages(
    tenantFirstName: string | undefined,
    title: string,
    description: string,
    state: LiaIntakeState,
  ): string[] {
    const name = tenantFirstName?.trim() || 'Bonjour';
    const text = `${title} ${description}`.trim();
    const s = state.signals ?? this.extractSignals(text);
    const messages: string[] = [];

    if (state.category === 'ROOF') {
      const roomPart = s.roomHint ? ` dans ${s.roomHint}` : '';
      if (s.rainingNow && s.roofLeak) {
        messages.push(
          `${name}, j’ai bien compris votre situation : il pleut en ce moment et vous avez une fuite ou infiltration de toiture${roomPart}.`,
        );
      } else if (s.roofLeak) {
        messages.push(
          `${name}, vous signalez une fuite ou infiltration liée à la toiture${roomPart}.`,
        );
      } else {
        messages.push(
          `${name}, vous signalez un problème d’étanchéité ou de toiture${roomPart}.`,
        );
      }
      messages.push(
        'En priorité : pensez à protéger vos affaires (bâche, seaux, déplacer ce qui risque d’être abîmé par l’eau).',
      );
      messages.push(
        'Une infiltration de toiture relève en principe de la charge du bailleur. Je confirmerai avec les éléments que vous allez me donner.',
      );
      return messages;
    }

    if (state.category === 'PLUMBING' && /fuite|eau|coule|goutte/i.test(text)) {
      messages.push(
        `${name}, j’ai noté un problème d’eau ou de fuite. Si l’eau coule encore, limitez les dégâts (seau, couper l’arrivée d’eau si vous savez le faire).`,
      );
    }
    if (usesWaterOnFloorPath(state)) {
      messages.push(
        `${name}, pour une flaque d’eau au sol, je vais vous demander si l’eau est claire, trouble ou mousseuse, et si elle apparaît à des heures précises — c’est indispensable pour le diagnostic.`,
      );
    }

    if (state.category === 'ELECTRICITY') {
      const lighting = isLightingOnlyScope(text, s, state.answers);
      const bulbDone = tenantAlreadyChangedBulb(text, state.answers);
      const saturated = isElectricityLightingIntakeSaturated(state);
      const newTenant = Boolean(state.answers.occupancy_note);
      if (lighting && newTenant && saturated) {
        const room = s.roomHint ? ` dans ${s.roomHint}` : '';
        messages.push(
          `${name}, bienvenue — j’ai bien lu votre souci d’éclairage${room} depuis votre emménagement.`,
        );
        messages.push(
          'Vous avez déjà fait les vérifications utiles (ampoule, compteur, disjoncteur) : je ne vais pas vous faire perdre de temps en répétant les mêmes questions.',
        );
        return messages;
      }
      if (lighting) {
        const room = s.roomHint ? ` (${s.roomHint})` : '';
        messages.push(
          `${name}, vous signalez un souci d’éclairage${room} — pas une coupure générale du logement.`,
        );
        if (bulbDone) {
          messages.push(
            'Vous avez déjà changé l’ampoule : je ne vous demanderai pas de refaire ce test. ' +
              'Nous allons orienter vers l’interrupteur, le disjoncteur du circuit et la douille si besoin.',
          );
        } else {
          messages.push(
            'Si l’ampoule n’a pas encore été testée, vous pourrez le préciser ; sinon nous vérifierons interrupteur et alimentation.',
          );
        }
      } else {
        messages.push(
          `${name}, pour un problème électrique, ne touchez pas une installation endommagée : coupez le circuit concerné si vous savez lequel.`,
        );
      }
    }

    return messages;
  }

  extractSignals(text: string): IntakeSignals {
    const t = text.toLowerCase();
    const roofLeak =
      /toiture|toit|infiltrat|gouttière|gouttiere/.test(t) ||
      (/fuite|fuit/.test(t) && /plafond|toit/.test(t));
    return {
      rainingNow: /\b(il pleut|pleut|pluie|pluvieux|intempérie)\b/.test(t),
      roofLeak,
      roomHint: this.extractRoomHint(text),
      situationPresent:
        /\b(il pleut|coule|goutte|fuit|infiltr|actuellement|en ce moment)\b/.test(
          t,
        ),
      landlordLikely: roofLeak,
    };
  }

  private extractRoomHint(text: string): string | undefined {
    const patterns = [
      /chambre\s+[\w\s]{0,40}?(?=,|\.|$)/i,
      /salon\s+[\w\s]{0,30}?(?=,|\.|$)/i,
      /cuisine\b/i,
      /salle de bain\b/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        return m[0].trim().replace(/\s+/g, ' ');
      }
    }
    return undefined;
  }

  private prefillAnswersFromInitialText(
    category: IntakeCategory,
    signals: IntakeSignals,
    title: string,
    description: string,
  ): Record<string, string> {
    const answers: Record<string, string> = {};
    const d = description.toLowerCase();

    if (category === 'ROOF') {
      if (signals.situationPresent || signals.rainingNow) {
        answers.since_when =
          'Situation actuelle (déjà décrite : présent / en cours).';
      }
      if (signals.rainingNow) {
        answers.when_rains =
          'Oui — il pleut actuellement (mentionné dans ma description).';
      }
      if (/protég|bâche|bache|seau|déplac/i.test(d)) {
        answers.protect_belongings =
          'Oui, déjà commencé ou prévu (mentionné par le locataire).';
      }
    }

    if (isWaterOnFloorReport('', description, answers)) {
      const sensors = extractDiagnosticSensors({ contextText: description });
      if (sensors.water_aspect) {
        answers.water_aspect = `Déjà indiqué : ${sensors.water_aspect}`;
      }
      if (sensors.timing_pattern) {
        answers.timing_pattern = `Déjà indiqué : ${sensors.timing_pattern}`;
      }
      if (sensors.building_floor) {
        answers.building_floor = sensors.building_floor;
      }
      if (sensors.weather_context) {
        answers.weather_context = sensors.weather_context;
      }
    }

    if (category === 'ELECTRICITY') {
      const full = `${title} ${description}`;
      if (isLightingOnlyScope(full, signals, answers)) {
        answers.scope =
          'Éclairage localisé (point lumineux, pas coupure générale).';
      }
    }

    return answers;
  }

  /** Tous les identifiants de questions scriptées (hors organisateur KB). */
  allScriptQuestionIds(category: IntakeCategory): string[] {
    return INTAKE_QUESTIONS[category].map((q) => q.id);
  }

  getCurrentQuestion(state: LiaIntakeState): IntakeQuestion | null {
    if (state.phase !== 'INTAKE') return null;
    if (state.intakeMode === 'llm_first') return null;

    if (state.organizer && state.intakeMode !== 'legacy') {
      const jarvisQ = pickJarvisCriticalQuestion(state);
      if (jarvisQ) {
        return { id: jarvisQ.id, text: jarvisQ.text };
      }
      return null;
    }

    if (state.organizer) {
      const tree = getPanneTreeById(state.organizer.panneId);
      if (!tree) return null;
      const ctx = buildOrganizerContext(
        state.intakeTitle ?? '',
        state.intakeDescription ?? '',
        state,
      );
      const cause = nextOrganizerCauseForIntake(
        tree,
        state.organizer,
        ctx,
      );
      if (!cause) return null;
      return {
        id: `${ORG_QUESTION_PREFIX}${cause.id}`,
        text: formatOrganizerQuestionText(tree, cause, state),
      };
    }

    const list = getIntakeQuestionsForState(state);
    const skipped = new Set(state.skippedQuestionIds ?? []);
    for (let i = state.stepIndex; i < list.length; i++) {
      const q = list[i];
      if (skipped.has(q.id)) continue;
      if (state.answers[q.id]?.trim()) continue;
      return { id: q.id, text: this.questionText(state, q) };
    }
    return null;
  }

  questionText(state: LiaIntakeState, q: IntakeQuestion): string {
    const ctx = `${Object.values(state.answers).join(' ')}`;
    if (
      state.category === 'ELECTRICITY' &&
      q.id === 'since_when' &&
      isLightingOnlyScope(ctx, state.signals, state.answers)
    ) {
      return 'Depuis quand cet éclairage ne fonctionne-t-il plus ?';
    }
    if (q.id === 'switch_ok' && state.signals?.roomHint) {
      return `L’interrupteur de ${state.signals.roomHint} fonctionne-t-il (marche et arrêt essayés) ?`;
    }
    return q.text;
  }

  reconcileStepIndex(state: LiaIntakeState): LiaIntakeState {
    if (state.intakeMode === 'llm_first') {
      if (state.answers.llm_intake_complete === 'oui') {
        return {
          ...state,
          phase: 'DONE',
          stepIndex: 0,
        };
      }
      return state.phase === 'DONE' ? state : { ...state, phase: 'INTAKE' };
    }

    if (
      state.intakeMode !== 'legacy' &&
      isJarvisReadyForImmediateVerdict(state) &&
      !this.needsPhoto(state)
    ) {
      return { ...state, stepIndex: 0, phase: 'DONE' };
    }

    if (
      state.category === 'ELECTRICITY' &&
      isElectricityLightingIntakeSaturated(state) &&
      !this.needsPhoto(state)
    ) {
      const list = getIntakeQuestionsForState(state);
      return {
        ...state,
        stepIndex: list.length,
        phase: 'DONE',
      };
    }

    if (
      state.category === 'PLUMBING' &&
      isPlumbingSinkLeakSaturated(state) &&
      !this.needsPhoto(state)
    ) {
      return { ...state, stepIndex: 0, phase: 'DONE' };
    }

    if (state.organizer && state.intakeMode !== 'legacy') {
      const jarvisQ = pickJarvisCriticalQuestion(state);
      if (!jarvisQ) {
        return {
          ...state,
          stepIndex: 0,
          phase: this.needsPhoto(state) ? 'AWAITING_PHOTO' : 'DONE',
        };
      }
      return { ...state, stepIndex: 0, phase: 'INTAKE' };
    }

    if (state.organizer) {
      const tree = getPanneTreeById(state.organizer.panneId);
      if (!tree) {
        return { ...state, organizer: undefined };
      }
      const ctx = buildOrganizerContext(
        state.intakeTitle ?? '',
        state.intakeDescription ?? '',
        state,
      );
      const next = nextOrganizerCauseForIntake(tree, state.organizer, ctx);
      if (!next) {
        return {
          ...state,
          stepIndex: 0,
          phase: this.needsPhoto(state) ? 'AWAITING_PHOTO' : 'DONE',
        };
      }
      return { ...state, stepIndex: 0, phase: 'INTAKE' };
    }

    const list = getIntakeQuestionsForState(state);
    const skipped = new Set(state.skippedQuestionIds ?? []);
    let stepIndex = 0;
    while (stepIndex < list.length) {
      const q = list[stepIndex];
      if (skipped.has(q.id) || state.answers[q.id]?.trim()) {
        stepIndex++;
        continue;
      }
      break;
    }
    if (stepIndex >= list.length) {
      return {
        ...state,
        stepIndex,
        phase: this.needsPhoto(state) ? 'AWAITING_PHOTO' : 'DONE',
      };
    }
    return { ...state, stepIndex, phase: 'INTAKE' };
  }

  recordAnswer(state: LiaIntakeState, answer: string): LiaIntakeState {
    const trimmed = answer.trim();
    if (isTenantLanguageGreeting(trimmed) && !state.answers[INTAKE_LANGUAGE_ANSWER_ID]) {
      const language = resolveLanguageFromGreeting(trimmed);
      return this.reconcileStepIndex({
        ...state,
        preferredLanguage: language,
        answers: { ...state.answers, [INTAKE_LANGUAGE_ANSWER_ID]: trimmed },
      });
    }
    const q = this.getCurrentQuestion(state);
    if (!q) return state;
    const answers = { ...state.answers, [q.id]: trimmed };
    let next: LiaIntakeState = { ...state, answers };
    if (isOrganizerQuestionId(q.id)) {
      next = applyOrganizerAnswer(next, q.id, trimmed);
    }
    return this.reconcileStepIndex(next);
  }

  /** Photo utile pour le diagnostic visuel (sauf cas purement administratif). */
  needsPhoto(state: LiaIntakeState): boolean {
    if (state.category === 'GENERIC') return false;
    if (state.category === 'ELECTRICITY') {
      if (usesLightingElectricityPath(state)) {
        return needsContextualElectricityPhoto(state);
      }
      return false;
    }
    if (usesWaterOnFloorPath(state)) {
      const ctx = `${state.intakeTitle ?? ''} ${state.intakeDescription ?? ''}`;
      const sensors = extractDiagnosticSensors({
        contextText: ctx,
        intakeAnswers: state.answers,
      });
      const missing = getMissingCriticalSensors({
        title: state.intakeTitle ?? '',
        description: state.intakeDescription ?? '',
        sensors,
        intakeAnswers: state.answers,
      });
      if (missing.length === 0) return false;
    }
    return true;
  }

  markDone(state: LiaIntakeState): LiaIntakeState {
    return { ...state, phase: 'DONE' };
  }

  /**
   * Saute les questions intake (bailleur a désactivé la conversation Lia).
   * Passe directement en attente photo ou en prêt pour analyse.
   */
  skipConversationIntake(
    title: string,
    description: string,
    requirePhoto: boolean,
  ): LiaIntakeState {
    const category = this.detectCategory(title, description);
    const questions = INTAKE_QUESTIONS[category];
    const answers: Record<string, string> = {};
    for (const q of questions) {
      answers[q.id] = '(conversation courte)';
    }
    const signals = this.extractSignals(`${title} ${description}`);
    const base: LiaIntakeState = {
      phase: 'INTAKE',
      category,
      stepIndex: questions.length,
      answers,
      signals,
    };
    if (requirePhoto && this.needsPhoto(base)) {
      return { ...base, phase: 'AWAITING_PHOTO' };
    }
    return { ...base, phase: 'DONE' };
  }

  welcomeIntro(tenantFirstName?: string): string {
    const name = tenantFirstName?.trim() || 'Bonjour';
    return (
      `${name}, merci pour votre signalement. ` +
      `J’analyse d’abord ce que vous décrivez, puis je vous poserai quelques questions si besoin.`
    );
  }

  photoRequestMessage(state?: LiaIntakeState): string {
    if (state?.category === 'ROOF') {
      return (
        'Merci pour ces précisions. Faites une photo pour le technicien : la zone touchée ' +
        '(taches au plafond, traces d’eau, gouttes…) avec le bouton « Prendre une photo » ci-dessous. ' +
        'Ensuite je lance l’analyse complète (charge locataire ou bailleur).'
      );
    }
    if (
      state?.category === 'ELECTRICITY' &&
      usesLightingElectricityPath(state) &&
      needsContextualElectricityPhoto(state)
    ) {
      return (
        'Merci pour ces précisions. Si vous le pouvez, envoyez une photo rapprochée de la douille ou du support d’ampoule ' +
        '(pas une photo de la pièce entière) — cela aide à confirmer une usure. ' +
        'Sinon décrivez l’état de la douille dans le fil : je lancerai l’analyse sans photo.'
      );
    }
    if (state?.category === 'ELECTRICITY') {
      return (
        'Merci pour ces réponses. Vos vérifications suffisent pour lancer le diagnostic sans photo de la pièce. ' +
        'Écrivez « pas de photo » si vous préférez passer directement à l’analyse.'
      );
    }
    return (
      'Merci pour ces réponses. Pour affiner le diagnostic, pouvez-vous m’envoyer une photo du problème ? ' +
      'Utilisez le bouton « Prendre une photo » ci-dessous (ou la galerie). ' +
      'Si votre appareil photo ne fonctionne pas, écrivez-le dans le fil : je lancerai l’analyse sans photo.'
    );
  }

  skipPhotoAck(): string {
    return (
      'Très bien. Je lance l’analyse avec votre description et vos réponses, sans photo. ' +
      'Vous pouvez fermer l’application : je vous préviendrai par notification.'
    );
  }
}
