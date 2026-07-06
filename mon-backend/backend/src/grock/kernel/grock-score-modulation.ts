import type { GrockInterlocutor } from './grock-interlocutor';
import type { GrockConfidenceScores } from './grock-confidence-scores';
import { clampScore, ensureScoresInThinking } from './grock-confidence-scores';
import type { PreprocessedSignalJournalSnapshot } from '../preprocessor/preprocessed-signal.serializer';
import type { GrockConversationState } from '../grock.service';

/** États qui concluent responsabilité / ticket. */
const CONCLUSIVE_STATES = new Set<GrockConversationState>([
  'bailleur_responsable',
  'locataire_responsable',
  'sinistre',
  'READY_TICKET',
]);

const ALARMIST_SPEECH =
  /112|secours|quittez|sortez du logement|éloignez-vous|urgence vitale|appelez les pompiers/i;

const SOFT_SAFETY_FALLBACK =
  'Restez prudent : sécurisez la zone si vous le pouvez sans vous exposer, et attendez les consignes du bailleur.';

export type DecisionModality = 'prudent' | 'normal' | 'ferme';

/** Bande cible communicationIntensity selon dangerLevel (Tête 2 → Tête 5). */
export function targetCommunicationBand(dangerLevel: number): { min: number; max: number } {
  if (dangerLevel <= 3) return { min: 1, max: 3 };
  if (dangerLevel <= 6) return { min: 4, max: 6 };
  return { min: 7, max: 10 };
}

export function inferDecisionModality(inferenceConfidence: number | undefined): DecisionModality {
  const inf = inferenceConfidence ?? 5;
  if (inf < 4) return 'prudent';
  if (inf <= 7) return 'normal';
  return 'ferme';
}

/** Aligne les scores après sortie modèle — sans diagnostiquer. */
export function enforceScoreCoherence(scores: GrockConfidenceScores): GrockConfidenceScores {
  const out: GrockConfidenceScores = { ...scores };

  if (out.dangerLevel !== undefined) {
    const band = targetCommunicationBand(out.dangerLevel);
    const current = out.communicationIntensity ?? Math.round((band.min + band.max) / 2);
    out.communicationIntensity = clampScore(
      Math.max(band.min, Math.min(band.max, current)),
    );
  }

  if (out.inferenceConfidence !== undefined && out.decisionConfidence === undefined) {
    out.decisionConfidence = out.inferenceConfidence;
  }

  return out;
}

/** dangerLevel ↔ communicationIntensity hors bande. */
export function isDangerCommunicationIncoherent(scores: GrockConfidenceScores): boolean {
  const danger = scores.dangerLevel;
  const intensity = scores.communicationIntensity;
  if (danger === undefined || intensity === undefined) return false;
  const band = targetCommunicationBand(danger);
  return intensity < band.min || intensity > band.max;
}

/** inferenceConfidence faible + conclusion ferme. */
export function isInferenceDecisionIncoherent(
  scores: GrockConfidenceScores,
  state: string | null | undefined,
): boolean {
  const inf = scores.inferenceConfidence;
  if (inf === undefined || inf >= 4) return false;
  if (!state || !CONCLUSIVE_STATES.has(state as GrockConversationState)) return false;
  return true;
}

/** Retire alarmisme verbal si dangerLevel bas (garde-fou Tête 5). */
export function softenAlarmistAcknowledgment(
  acknowledgment: string,
  dangerLevel: number | undefined,
): string {
  if (dangerLevel === undefined || dangerLevel >= 4) return acknowledgment;
  if (!ALARMIST_SPEECH.test(acknowledgment)) return acknowledgment;

  const kept = acknowledgment
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !ALARMIST_SPEECH.test(sentence))
    .join(' ')
    .trim();

  return kept || SOFT_SAFETY_FALLBACK;
}

/** Modulation décision (Tête 3 → Tête 4) : prudence si inférence faible. */
export function modulateDecisionState(
  state: GrockConversationState,
  scores: GrockConfidenceScores,
): GrockConversationState {
  if (!CONCLUSIVE_STATES.has(state)) return state;

  const modality = inferDecisionModality(scores.inferenceConfidence);
  if (modality !== 'prudent') return state;

  const decisionConf = scores.decisionConfidence ?? scores.inferenceConfidence ?? 5;
  if (decisionConf >= 4) return state;

  if ((scores.signalQuality ?? 10) < 4) return 'NEED_PHOTO';
  return 'ASK_ONE_QUESTION';
}

/** Déclencheurs doctrine à partir des scores (matière arbitrage humain). */
export function scoreDoctrineTriggers(scores: GrockConfidenceScores): string[] {
  const triggers: string[] = [];
  if (isDangerCommunicationIncoherent(scores)) {
    triggers.push(
      'dangerLevel faible + communicationIntensity forte → leçon proportionnalité parole',
    );
  }
  if ((scores.signalQuality ?? 10) < 4) {
    triggers.push('signalQuality faible → doctrine preuve photo avant conclusion');
  }
  if ((scores.inferenceConfidence ?? 10) < 4) {
    triggers.push('inferenceConfidence faible → doctrine prudence / enquête avant trancher');
  }
  if ((scores.decisionConfidence ?? 10) < 4) {
    triggers.push('decisionConfidence faible → doctrine confirmation nécessaire');
  }
  return triggers;
}

/** Bloc prompt — règles actives de modulation (injecté avant raisonnement). */
export function buildScoreModulationPromptBlock(
  interlocutor: GrockInterlocutor,
  signalQuality: number,
): string {
  const lines = [
    '--- MODULATION COGNITIVE PAR SCORES (active) ---',
    'Les scores modulent les têtes — ils ne remplacent pas le raisonnement.',
    'Tête 2 → Tête 5 : dangerLevel 0–3 → communicationIntensity 1–3 ; 4–6 → 4–6 ; 7–10 → 7–10.',
    'Tête 3 → Tête 4 : inferenceConfidence < 4 → décision prudente (NEED_PHOTO / ASK_ONE_QUESTION) ; 4–7 normal ; > 7 ferme.',
    `signalQuality entrée = ${signalQuality}/10.`,
  ];
  if (signalQuality < 4) {
    lines.push('Doctrine active : signalQuality faible — demander photo / preuve avant conclusion ferme.');
  }

  if (interlocutor === 'tenant') {
    lines.push(
      'Locataire : parole modulée par communicationIntensity — jamais de scores visibles, jamais dangerLevel brut.',
    );
  } else if (interlocutor === 'technician') {
    lines.push(
      'Technicien : expose dangerLevel et factExtractionConfidence ; parole technique.',
    );
  } else if (interlocutor === 'landlord') {
    lines.push(
      'Bailleur : expose inferenceConfidence et decisionConfidence ; parole décisionnelle.',
    );
  } else if (interlocutor === 'admin') {
    lines.push('Admin : tous les scores + preprocessedSignal + bloc [SCORES] complet.');
  }

  return lines.join('\n');
}

export function filterScoresForSurface(
  scores: GrockConfidenceScores,
  interlocutor: GrockInterlocutor,
): GrockConfidenceScores | null {
  if (interlocutor === 'tenant') return null;

  if (interlocutor === 'technician') {
    return {
      signalQuality: scores.signalQuality,
      dangerLevel: scores.dangerLevel,
      factExtractionConfidence: scores.factExtractionConfidence,
    };
  }

  if (interlocutor === 'landlord') {
    return {
      signalQuality: scores.signalQuality,
      inferenceConfidence: scores.inferenceConfidence,
      decisionConfidence: scores.decisionConfidence,
    };
  }

  return { ...scores };
}

export function filterPreprocessedSignalForSurface(
  snapshot: PreprocessedSignalJournalSnapshot,
  interlocutor: GrockInterlocutor,
): PreprocessedSignalJournalSnapshot | null {
  if (interlocutor === 'tenant') return null;

  if (interlocutor === 'technician') {
    return {
      interlocutor: snapshot.interlocutor,
      title: snapshot.title,
      description: snapshot.description,
      tenantMessage: snapshot.tenantMessage,
      tenantFirstName: snapshot.tenantFirstName,
      signalQuality: snapshot.signalQuality,
      signalQualityFactors: snapshot.signalQualityFactors,
      visualPerceptionRaw: snapshot.visualPerceptionRaw,
      visionModel: snapshot.visionModel,
      sessionTurnCount: snapshot.sessionTurnCount,
      meta: snapshot.meta,
    };
  }

  if (interlocutor === 'landlord') {
    return {
      interlocutor: snapshot.interlocutor,
      title: snapshot.title,
      description: snapshot.description,
      tenantMessage: snapshot.tenantMessage,
      tenantFirstName: snapshot.tenantFirstName,
      signalQuality: snapshot.signalQuality,
      signalQualityFactors: snapshot.signalQualityFactors,
      visualPerceptionRaw: null,
      visionModel: null,
      sessionTurnCount: snapshot.sessionTurnCount,
      meta: snapshot.meta,
    };
  }

  return snapshot;
}

/** Applique modulation post-parse : scores, état, parole. */
export function applyScoreModulation(params: {
  scores: GrockConfidenceScores;
  state: GrockConversationState;
  acknowledgment: string;
  thinking: string;
}): {
  scores: GrockConfidenceScores;
  state: GrockConversationState;
  acknowledgment: string;
  thinking: string;
} {
  const notes: string[] = [];
  let scores = enforceScoreCoherence(params.scores);
  const priorIntensity = params.scores.communicationIntensity;
  if (
    priorIntensity !== undefined &&
    scores.communicationIntensity !== priorIntensity
  ) {
    notes.push(
      `communicationIntensity ${priorIntensity}→${scores.communicationIntensity} (dangerLevel=${scores.dangerLevel})`,
    );
  }

  const priorState = params.state;
  const state = modulateDecisionState(priorState, scores);
  if (state !== priorState) {
    notes.push(
      `state ${priorState}→${state} (inferenceConfidence=${scores.inferenceConfidence}, modality=${inferDecisionModality(scores.inferenceConfidence)})`,
    );
  }

  const priorAck = params.acknowledgment;
  const acknowledgment = softenAlarmistAcknowledgment(priorAck, scores.dangerLevel);
  if (acknowledgment !== priorAck) {
    notes.push('parole alarmiste atténuée (dangerLevel bas)');
  }

  scores = enforceScoreCoherence(scores);

  let thinking = ensureScoresInThinking(params.thinking, scores);
  const doctrine = scoreDoctrineTriggers(scores);
  if (notes.length) {
    thinking = `${thinking}\n\n[MODULATION] ${notes.join(' ; ')}`;
  }
  if (doctrine.length) {
    thinking = `${thinking}\n[DOCTRINE-TRIGGERS] ${doctrine.join(' | ')}`;
  }

  return { scores, state, acknowledgment, thinking };
}
