import { Injectable } from '@nestjs/common';
import type { CompanionUiState } from '../conversation/lia-companion.types';
import { buildElectricityJuristHint } from '../../diagnostiqueur/rules/lia-electricity-rules';
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
} from './lia-jarvis-intake.engine';
import { isPlumbingSinkLeakSaturated } from './lia-intake-plumbing-extract';
import {
  INTAKE_LANGUAGE_ANSWER_ID,
  isTenantLanguageGreeting,
  resolveLanguageFromGreeting,
} from '../../shared/lia-tenant-greeting';

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
  /** @deprecated Legacy — Living Intelligence ne pose plus de questions scriptées. */
  organizer?: { panneId: string; eliminatedCauseIds: string[]; causeAnswers: Record<string, string> };
  intakeTitle?: string;
  intakeDescription?: string;
  /** Langue choisie via salutation (Bonjou → gcf). */
  preferredLanguage?: string;
  /** jarvis = Agent de Raisonnement Systémique (seul pilote dialogue) ; legacy = rétrocompat. */
  intakeMode?: 'jarvis' | 'legacy';
  /** Faits extraits à 360° (non redemandés au locataire). */
  jarvisFacts?: Record<string, string>;
  /** Changement de sujet suspect — confirmation explicite requise avant fermeture. */
  topicChangePending?: boolean;
  pendingTopicLabel?: string;
  /** Évite un double appel Grock sur le même message locataire. */
  grockAlreadyCalled: boolean;
  /** Cache mémoire uniquement — toujours null dans Ticket.aiLastDecision.intake. */
  lastGrockReply: import('./lia-jarvis-pilot.service').JarvisPilotTurn | null;
}

export interface IntakeReactiveTurn {
  state: LiaIntakeState;
  /** Reformulation / prise en compte de ce que le locataire vient de dire. */
  acknowledgment: string | null;
  /** Prochaine question à poser, ou null si photo / analyse. */
  nextQuestionText: string | null;
  /** Statut affiché sous ce message Lia (synchronisé avec la parole). */
  uiStatus?: import('../conversation/lia-message-ui-status').LiaMessageUiStatus;
  /** Parole déjà poussée dans le fil (ex. auto-conclusion bailleur). */
  hostMessageAlreadySent?: boolean;
}

/** @deprecated — arbres scriptés supprimés (Living Intelligence). */
export const INTAKE_QUESTIONS: Record<IntakeCategory, IntakeQuestion[]> = {
  PLUMBING: [],
  ROOF: [],
  ELECTRICITY: [],
  GENERIC: [],
};

/** @deprecated */
export const INTAKE_WATER_ON_FLOOR: IntakeQuestion[] = [];

/** @deprecated */
export const INTAKE_LIGHTING_ELECTRICITY: IntakeQuestion[] = [];

/** Contexte intake stocké dans Ticket.aiLastDecision.intake */
export function parseIntakeState(
  aiLastDecision: unknown,
): LiaIntakeState | null {
  if (!aiLastDecision || typeof aiLastDecision !== 'object') return null;
  const raw = (aiLastDecision as { intake?: LiaIntakeState }).intake;
  if (!raw || raw.phase == null) return null;
  return normalizeIntakeState(raw);
}

/** Valeurs par défaut et champs non persistés (cache Grock en mémoire seulement). */
export function normalizeIntakeState(state: LiaIntakeState): LiaIntakeState {
  return {
    ...state,
    grockAlreadyCalled: state.grockAlreadyCalled ?? false,
    lastGrockReply: null,
  };
}

/** État intake sérialisable dans Ticket.aiLastDecision — sans cache Grock. */
export function sanitizeIntakeForTicket(state: LiaIntakeState): LiaIntakeState {
  return {
    ...state,
    grockAlreadyCalled: state.grockAlreadyCalled ?? false,
    lastGrockReply: null,
  };
}

export function buildIntakePayload(
  state: LiaIntakeState,
  companion?: CompanionUiState,
): Record<string, unknown> {
  const intake = sanitizeIntakeForTicket(state);
  return companion ? { intake, companion } : { intake };
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
  const lines: string[] = [];
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
      /toiture|toit|pluie|gouttière|gouttiere|infiltration|moisissure|moisi|humidit|salp[eè]tre/.test(
        t,
      )
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
    const waterFloor = isWaterOnFloorReport(title, description, answers);

    const base: LiaIntakeState = {
      phase: 'INTAKE',
      category,
      stepIndex: 0,
      answers,
      signals,
      intakeTitle: title,
      intakeDescription: description,
      intakeMode: 'jarvis',
      jarvisFacts: jarvisFactsFromExtract ?? {},
      skippedQuestionIds: [...(skippedFromExtract ?? [])],
      grockAlreadyCalled: false,
      lastGrockReply: null,
    };
    const jarvisState = ensureJarvisOrganizer(base, title, description);
    const reconciled = this.reconcileStepIndex(jarvisState);

    // Éclairage : si le locataire a déjà tout donné (ampoule, compteur/disjoncteur…)
    // et qu'aucune photo n'est utile, on ne le fait pas répéter — l'intake est
    // saturé, on passe directement en DONE (le diagnostic prend le relais).
    if (
      reconciled.category === 'ELECTRICITY' &&
      isElectricityLightingIntakeSaturated(reconciled) &&
      !needsContextualElectricityPhoto(reconciled)
    ) {
      return this.markDone(reconciled);
    }

    return reconciled;
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

  getCurrentQuestion(_state: LiaIntakeState): IntakeQuestion | null {
    return null;
  }

  questionText(_state: LiaIntakeState, q: IntakeQuestion): string {
    return q.text;
  }

  reconcileStepIndex(state: LiaIntakeState): LiaIntakeState {
    if (
      state.answers.jarvis_intake_complete === 'oui' ||
      state.answers.jarvis_handoff === 'oui'
    ) {
      return { ...state, phase: 'DONE', stepIndex: 0 };
    }
    return { ...state, phase: state.phase === 'DONE' ? 'DONE' : 'INTAKE', stepIndex: 0 };
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
    return state;
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
      grockAlreadyCalled: false,
      lastGrockReply: null,
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
