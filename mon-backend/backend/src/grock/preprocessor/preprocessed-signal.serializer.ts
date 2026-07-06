import type { GrockInterlocutor } from '../kernel/grock-interlocutor';
import type { SignalQualityMeta } from '../kernel/grock-confidence-scores';
import type { PreprocessedSignal } from './preprocessor.types';

/**
 * Snapshot journalisable du signal Couche 0 — sans fil conversationnel complet
 * (évite duplication ; sessionTurnCount suffit aux sondes).
 */
export interface PreprocessedSignalJournalSnapshot {
  interlocutor: GrockInterlocutor;
  title: string;
  description: string;
  tenantMessage: string;
  tenantFirstName: string;
  signalQuality: number;
  signalQualityFactors: SignalQualityMeta;
  visualPerceptionRaw: string | null;
  visionModel: string | null;
  sessionTurnCount: number;
  meta: PreprocessedSignal['meta'];
}

export function serializePreprocessedSignalForJournal(
  signal: PreprocessedSignal,
): PreprocessedSignalJournalSnapshot {
  return {
    interlocutor: signal.interlocutor,
    title: signal.title,
    description: signal.description,
    tenantMessage: signal.tenantMessage,
    tenantFirstName: signal.tenantFirstName,
    signalQuality: signal.signalQuality,
    signalQualityFactors: signal.signalQualityFactors,
    visualPerceptionRaw: signal.visualPerceptionRaw,
    visionModel: signal.visionModel,
    sessionTurnCount: signal.sessionMessages.length,
    meta: signal.meta,
  };
}

export function parsePreprocessedSignalFromJournal(
  raw: string | null | undefined,
): PreprocessedSignalJournalSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as
      | PreprocessedSignalJournalSnapshot
      | { signal?: PreprocessedSignalJournalSnapshot };
    if (parsed && typeof parsed === 'object' && 'signal' in parsed && parsed.signal) {
      return parsed.signal;
    }
    return parsed as PreprocessedSignalJournalSnapshot;
  } catch {
    return null;
  }
}
