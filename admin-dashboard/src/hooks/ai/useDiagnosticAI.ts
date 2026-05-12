import { useCallback, useMemo } from 'react';

export interface DiagnosticHint {
  category: string;
  severity: 'low' | 'medium' | 'high';
  hint: string;
}

/**
 * IA Diagnostic — catégories types pour tickets logement.
 */
export function useDiagnosticAI() {
  const suggest = useCallback((description: string): DiagnosticHint => {
    const d = description.toLowerCase();

    if (d.includes('électr') || d.includes('prise') || d.includes('disjonct')) {
      return {
        category: 'ELECTRICITY',
        severity: 'high',
        hint: 'Problème électrique : évitez de surcharger les circuits et signalez rapidement.',
      };
    }
    if (
      d.includes('humidit') ||
      d.includes('moisis') ||
      d.includes('condensation')
    ) {
      return {
        category: 'HUMIDITY',
        severity: 'medium',
        hint: 'Humidité / moisissures : aérer si possible et documenter par photos pour le ticket.',
      };
    }
    if (d.includes('fuite') || d.includes('eau') || d.includes('plomb')) {
      return {
        category: 'PLUMBING',
        severity: 'high',
        hint: 'Fuite d’eau : couper l’arrivée si vous le pouvez sans danger et ouvrez un ticket.',
      };
    }
    if (d.includes('serrure') || d.includes('clé') || d.includes('porte')) {
      return {
        category: 'LOCKSMITH',
        severity: 'medium',
        hint: 'Serrurerie : précisez si la porte d’entrée ou une porte intérieure est concernée.',
      };
    }
    return {
      category: 'OTHER',
      severity: 'low',
      hint: 'Décrivez le problème avec le plus de précision possible et ajoutez des photos si utile.',
    };
  }, []);

  return useMemo(() => ({ suggest }), [suggest]);
}
