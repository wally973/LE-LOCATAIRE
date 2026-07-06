import { extractDiagnosticSensors } from '../../agents/shared/lia-diagnostic-sensors';
import type { PreprocessedSignal } from '../preprocessor/preprocessor.types';
import { buildSignalCorpus } from './corpus.util';
import type { Head1AnalysisInput } from './head-input.types';

const WATER =
  /eau|goutte|gouttes|fuite|infiltr|humid|humide|coule|coul|écoul|ecoul|mouill|dégât|degat|auréole|aureole|tache/i;
const ACTIVE_WATER =
  /goutte|coule|coul|écoule|ecoule|fuite active|eau active|mouill|humide|trace d'eau|traces d'eau|écoulement/i;
const CEILING = /plafond|infiltr|toitur|façade|facade|mur humide|haut de mur/i;
const HUMIDITY_TRACES = /humid|tache|auréole|aureole|trace|moisi|salp[eè]tre/i;
const LUMINAIRE = /prise|ampoule|luminaire|douille|électri|electri|courant|plafonnier/i;
const ROOM =
  /salle de bain|sdb|wc|toilette|cuisine|salon|chambre|buanderie|salle d'eau|salle d eau/i;

/**
 * Tête 1 — faits observables (texte + perception + capteurs diagnostic).
 */
export function buildHead1AnalysisInput(signal: PreprocessedSignal): Head1AnalysisInput {
  const contextText = [
    signal.title,
    signal.description,
    signal.tenantMessage,
    ...signal.sessionMessages.map((m) => m.text),
  ].join('\n');

  const sensors = extractDiagnosticSensors({ contextText });
  const corpus = buildSignalCorpus(signal);
  const perception = (signal.visualPerceptionRaw ?? '').toLowerCase();
  const triggers: string[] = [];

  const waterSignal = WATER.test(corpus);
  const activeWater = ACTIVE_WATER.test(corpus);
  const ceilingSignal =
    CEILING.test(corpus) || sensors.symptom_anchor === 'plafond' || /plafond/i.test(perception);
  const humidityTraces = HUMIDITY_TRACES.test(corpus) || HUMIDITY_TRACES.test(perception);
  const luminaireNearby = LUMINAIRE.test(corpus) || LUMINAIRE.test(perception);
  const hasPhoto = signal.meta.imageProcessed;
  const roomKnown =
    ROOM.test(corpus) || Boolean(sensors.symptom_anchor && sensors.symptom_anchor !== 'équipement sanitaire');

  if (waterSignal) triggers.push('eau signalée');
  if (activeWater) triggers.push('écoulement actif');
  if (ceilingSignal) triggers.push('plafond / infiltration');
  if (humidityTraces) triggers.push('traces humidité');
  if (luminaireNearby) triggers.push('luminaire / électricité à proximité');
  if (sensors.symptom_anchor) triggers.push(`ancrage=${sensors.symptom_anchor}`);
  if (sensors.building_floor) triggers.push(`étage=${sensors.building_floor}`);
  if (hasPhoto) triggers.push('photo fournie');
  if (!roomKnown) triggers.push('pièce non précisée');

  return {
    waterSignal,
    activeWater,
    ceilingSignal,
    humidityTraces,
    luminaireNearby,
    hasPhoto,
    roomKnown,
    symptomAnchor: sensors.symptom_anchor ?? null,
    waterAspect: sensors.water_aspect ?? null,
    buildingFloor: sensors.building_floor ?? null,
    triggers,
  };
}

export function renderHead1PromptBlock(input: Head1AnalysisInput): string {
  const lines = [
    '--- Tête 1 · ANALYSE — faits structurés (capteurs) ---',
    `Signaux : ${input.triggers.length ? input.triggers.join(' ; ') : 'aucun signal spécifique'}.`,
    `Eau : ${input.waterSignal ? 'oui' : 'non'} ; écoulement actif : ${input.activeWater ? 'oui' : 'non'} ; plafond/infiltration : ${input.ceilingSignal ? 'oui' : 'non'}.`,
    `Traces humidité : ${input.humidityTraces ? 'oui' : 'non'} ; luminaire/électricité proche : ${input.luminaireNearby ? 'oui' : 'non'} ; photo : ${input.hasPhoto ? 'oui' : 'non'} ; pièce connue : ${input.roomKnown ? 'oui' : 'non'}.`,
  ];
  if (input.symptomAnchor) lines.push(`Ancrage symptôme : ${input.symptomAnchor}.`);
  if (input.buildingFloor) lines.push(`Étage : ${input.buildingFloor}.`);
  lines.push('Ne déduis rien ici — score factExtractionConfidence uniquement.');
  return lines.join('\n');
}
