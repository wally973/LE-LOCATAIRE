import { useCallback, useMemo } from 'react';
import { minimalCleanText } from './evaluateGuardrail';

/**
 * IA Nettoyage — normalisation de saisie (sans stockage).
 */
export function useCleaningAI() {
  const sanitizeUserInput = useCallback((raw: string) => {
    return minimalCleanText(raw);
  }, []);

  return useMemo(() => ({ sanitizeUserInput }), [sanitizeUserInput]);
}
