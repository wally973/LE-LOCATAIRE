/**
 * Climatisation (Guyane) — diagnostic différentiel Savoir-Voir.
 * Élimination avant conclusion : bac condensats vs fuite frigorifique vs infiltration toiture.
 */
import type { DiagnosticSensors } from '../../shared/lia-diagnostic-state.types';

export interface HvacPhotoCues {
  /** Auréole sombre au plafond / mur (souvent confondu avec infiltration). */
  darkHaloVisible?: boolean;
  /** Eau / mare sous l’unité intérieure, bac plein. */
  condensateOverflowVisible?: boolean;
  /** Traces huileuses / suintement violet sur liaisons (fuite gaz). */
  refrigerantOilResidue?: boolean;
  /** Gouttelettes localisées sous split, sans auréole plafond. */
  stainUnderIndoorUnit?: boolean;
}

export interface HvacHypothesis {
  id: string;
  label: string;
  probability: number;
  responsibilityHint: 'LOCATAIRE' | 'BAILLEUR' | 'NUANCE';
  eliminated?: boolean;
  eliminationReason?: string;
}

export interface HvacDifferentialResult {
  category: 'HEATING';
  leadingHypothesisId: string;
  hypotheses: HvacHypothesis[];
  observation: string;
  responsibilityHint: 'LOCATAIRE' | 'BAILLEUR' | 'NUANCE';
  /** Infiltration toiture écartée (vision + capteurs). */
  roofInfiltrationExcluded: boolean;
}

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isHvacSignalement(text: string): boolean {
  const t = norm(text);
  return /\b(clim|climatisation|climatiseur|split|pac|condensat|refrigerant|frigorifique)\b/.test(
    t,
  );
}

function isDrySeason(sensors: DiagnosticSensors): boolean {
  return /sec/.test(norm(sensors.weather_context ?? ''));
}

/** Extrait des indices vision depuis texte locataire (simulation / fallback). */
export function inferHvacPhotoCuesFromText(text: string): HvacPhotoCues {
  const t = norm(text);
  return {
    darkHaloVisible: /aureole|halo|trace sombre|tache sombre|auréole/.test(t),
    condensateOverflowVisible:
      /bac a condensat|bac condensat|condensat|eau sous.*(clim|split)|goutte.*unit/.test(
        t,
      ),
    refrigerantOilResidue:
      /huile|trace violet|suintement|fuite frigo|gaz refrigerant|ne refroidit plus|plus froid/.test(
        t,
      ),
    stainUnderIndoorUnit: /sous.*(clim|split|unite interieure)|mare|flaque/.test(t),
  };
}

/**
 * Diagnostic différentiel clim — REF vision + capteurs.
 * Auréole sombre + saison sèche → fuite interne (pas toiture).
 */
export function runHvacDifferential(params: {
  contextText: string;
  sensors: DiagnosticSensors;
  photo?: HvacPhotoCues;
}): HvacDifferentialResult {
  const photo = {
    ...inferHvacPhotoCuesFromText(params.contextText),
    ...params.photo,
  };
  const dry = isDrySeason(params.sensors);

  const hypotheses: HvacHypothesis[] = [
    {
      id: 'hyp_hvac_condensate_blocked',
      label: 'Bac à condensats bouché / évacuation condensats (entretien)',
      probability: 0.45,
      responsibilityHint: 'LOCATAIRE',
    },
    {
      id: 'hyp_hvac_refrigerant_leak',
      label: 'Fuite frigorifique (réseau fluide — technicien frigoriste)',
      probability: 0.35,
      responsibilityHint: 'BAILLEUR',
    },
    {
      id: 'hyp_hvac_roof_infiltration',
      label: 'Infiltration toiture / pluie',
      probability: 0.2,
      responsibilityHint: 'BAILLEUR',
    },
  ];

  let roofInfiltrationExcluded = false;

  if (photo.darkHaloVisible && dry) {
    roofInfiltrationExcluded = true;
    const roof = hypotheses.find((h) => h.id === 'hyp_hvac_roof_infiltration')!;
    roof.eliminated = true;
    roof.probability = 0.03;
    roof.eliminationReason =
      'Auréole sombre en saison sèche : incompatible avec infiltration pluie/toiture — orientation fuite interne (unité ou condensats).';
  }

  if (photo.refrigerantOilResidue) {
    const frigo = hypotheses.find((h) => h.id === 'hyp_hvac_refrigerant_leak')!;
    frigo.probability = 0.72;
    const cond = hypotheses.find((h) => h.id === 'hyp_hvac_condensate_blocked')!;
    cond.probability = 0.15;
  } else if (photo.condensateOverflowVisible || photo.stainUnderIndoorUnit) {
    const cond = hypotheses.find((h) => h.id === 'hyp_hvac_condensate_blocked')!;
    cond.probability = 0.68;
    const frigo = hypotheses.find((h) => h.id === 'hyp_hvac_refrigerant_leak')!;
    frigo.probability = 0.2;
  }

  if (roofInfiltrationExcluded) {
    const cond = hypotheses.find((h) => h.id === 'hyp_hvac_condensate_blocked')!;
    const frigo = hypotheses.find((h) => h.id === 'hyp_hvac_refrigerant_leak')!;
    if (!photo.refrigerantOilResidue) {
      cond.probability = Math.max(cond.probability, 0.55);
    }
    frigo.probability = Math.max(frigo.probability, 0.25);
  }

  const active = hypotheses.filter((h) => !h.eliminated);
  const total = active.reduce((s, h) => s + h.probability, 0) || 1;
  for (const h of active) {
    h.probability = Math.round((h.probability / total) * 1000) / 1000;
  }
  active.sort((a, b) => b.probability - a.probability);
  const leading = active[0]!;

  let observation =
    `Climatisation — hypothèse retenue : ${leading.label} (${Math.round(leading.probability * 100)} %).`;
  if (roofInfiltrationExcluded) {
    observation +=
      ' Auréole sombre observée alors qu’il ne pleut pas : ce n’est pas une infiltration de toiture, mais un désordre lié au climatiseur ou à ses condensats.';
  }

  return {
    category: 'HEATING',
    leadingHypothesisId: leading.id,
    hypotheses,
    observation,
    responsibilityHint: leading.responsibilityHint,
    roofInfiltrationExcluded,
  };
}
