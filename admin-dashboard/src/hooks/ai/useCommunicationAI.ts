import { useCallback, useMemo } from 'react';

/**
 * IA Communication — ton, apaisement, reformulation (sans inventer de faits).
 */
export function useCommunicationAI() {
  const polish = useCallback((text: string, _tone?: 'friendly' | 'formal') => {
    return text.replace(/\s+\n/g, '\n').trim();
  }, []);

  const softenHostileOpeners = useCallback((text: string, hostile: boolean) => {
    if (!hostile) return text;
    return text.replace(
      /^/,
      'Pour avancer sereinement sur votre logement, voici des éléments généraux :\n\n',
    );
  }, []);

  return useMemo(
    () => ({ polish, softenHostileOpeners }),
    [polish, softenHostileOpeners],
  );
}
