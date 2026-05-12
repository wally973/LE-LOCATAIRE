import { useCallback, useMemo } from 'react';
import { evaluateGuardrail, type EvaluateGuardrailOptions } from './evaluateGuardrail';
import {
  dispatchGuardrailRefusal,
  type AIGuardrailRefusalPayload,
} from './aiCoachEvents';
import { GUARDRAIL_REFUSAL_MESSAGE_FR } from './legalDisclaimer';
import type { AIGuardrailResult } from './pipelineTypes';
import { getRgpdStrictAiMode } from './useRgpdStrictAiPrefs';

export interface UseAIGuardrailOptions {
  /** Si false, n’émet pas l’événement avatar (tests). */
  notifyAvatarOnRefusal?: boolean;
  onRefusal?: (payload: AIGuardrailRefusalPayload) => void;
  /** Surcharge du mode strict RGPD (sinon préférences locales). */
  rgpdStrictMode?: boolean;
}

/**
 * Bride IA — analyse le texte, détecte hors périmètre, notifie l’avatar en cas de refus.
 */
export function useAIGuardrail(options: UseAIGuardrailOptions = {}) {
  const { notifyAvatarOnRefusal = true, onRefusal, rgpdStrictMode } = options;

  const baseOpts = (): EvaluateGuardrailOptions => ({
    rgpdStrictMode: rgpdStrictMode ?? getRgpdStrictAiMode(),
  });

  const evaluate = useCallback(
    (userText: string, override?: EvaluateGuardrailOptions): AIGuardrailResult =>
      evaluateGuardrail(userText, { ...baseOpts(), ...override }),
    [rgpdStrictMode],
  );

  const evaluateAndNotify = useCallback(
    (
      userText: string,
      override?: EvaluateGuardrailOptions,
    ): AIGuardrailResult => {
      const result = evaluateGuardrail(userText, { ...baseOpts(), ...override });
      if (!result.allowed) {
        const payload: AIGuardrailRefusalPayload = {
          safeMessage: result.safeMessage ?? GUARDRAIL_REFUSAL_MESSAGE_FR,
          reason: result.reason,
        };
        onRefusal?.(payload);
        if (notifyAvatarOnRefusal) {
          dispatchGuardrailRefusal(payload);
        }
      }
      return result;
    },
    [rgpdStrictMode, notifyAvatarOnRefusal, onRefusal],
  );

  return useMemo(
    () => ({
      evaluate,
      evaluateAndNotify,
    }),
    [evaluate, evaluateAndNotify],
  );
}
