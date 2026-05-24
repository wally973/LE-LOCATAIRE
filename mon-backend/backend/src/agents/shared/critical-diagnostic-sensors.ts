/**
 * Capteurs critiques avant lancement du pipeline diagnostic (eau au sol — REF).
 */
import { isWaterOnFloorReport } from './lia-diagnostic-sensors';
import type { DiagnosticSensors } from './lia-diagnostic-state.types';

export type CriticalSensorKey = keyof Pick<
  DiagnosticSensors,
  'water_aspect' | 'timing_pattern' | 'building_floor'
>;

const WATER_ON_FLOOR_CRITICAL: CriticalSensorKey[] = [
  'water_aspect',
  'timing_pattern',
  'building_floor',
];

const LABELS: Record<CriticalSensorKey, string> = {
  water_aspect: 'l’aspect de l’eau (claire, trouble, savonneuse…)',
  timing_pattern: 'les horaires d’apparition (créneau précis si possible)',
  building_floor: 'votre étage dans l’immeuble (RDC, R+1…)',
};

/** Capteurs manquants pour un signalement « eau au sol ». */
export function getMissingCriticalSensors(params: {
  title: string;
  description: string;
  sensors: DiagnosticSensors;
  intakeAnswers?: Record<string, string>;
}): CriticalSensorKey[] {
  if (
    !isWaterOnFloorReport(
      params.title,
      params.description,
      params.intakeAnswers,
    )
  ) {
    return [];
  }
  return WATER_ON_FLOOR_CRITICAL.filter(
    (key) => !params.sensors[key]?.trim(),
  );
}

export function buildMissingCriticalSensorsMessage(
  missing: CriticalSensorKey[],
): string {
  if (!missing.length) return '';
  const items = missing.map((k) => LABELS[k]).join(' ; ');
  return (
    'Avant de lancer le diagnostic complet, il nous manque des précisions essentielles : ' +
    `${items}. ` +
    'Répondez aux questions ci-dessus dans le fil — l’analyse reprendra dès que ces éléments sont renseignés.'
  );
}
