/**
 * Libellés capteurs pour synthèses locataire / bailleur (Phase 4).
 */
import type { DiagnosticSensors } from './lia-diagnostic-state.types';

const SENSOR_LABELS: Partial<Record<keyof DiagnosticSensors, string>> = {
  weather_context: 'Contexte météo',
  water_aspect: 'Aspect de l’eau',
  building_floor: 'Niveau du logement',
  timing_pattern: 'Créneau horaire',
};

/** Ex. « Diagnostic établi en mode Saison sèche. » */
export function formatDiagnosticModeHeader(
  sensors: DiagnosticSensors | undefined,
): string | null {
  const mode = sensors?.weather_context?.trim();
  if (!mode) return null;
  return `Diagnostic établi en mode ${mode}.`;
}

/** Lignes détaillées pour tous les capteurs renseignés. */
export function formatSensorDetailLines(
  sensors: DiagnosticSensors | undefined,
): string[] {
  if (!sensors) return [];
  const lines: string[] = [];
  for (const key of Object.keys(SENSOR_LABELS) as (keyof DiagnosticSensors)[]) {
    const value = sensors[key]?.trim();
    if (!value) continue;
    lines.push(`• ${SENSOR_LABELS[key]} : ${value}`);
  }
  return lines;
}
