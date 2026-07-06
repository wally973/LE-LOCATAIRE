import type { PreprocessedSignal } from '../preprocessor/preprocessor.types';

/**
 * Signal générique — hors métier infiltration / sinistre.
 * Pour tests noyau T1/T2 et isolation pack neutre vs logement social.
 */
export function buildGenericTenantSignal(
  overrides: Partial<PreprocessedSignal> = {},
): PreprocessedSignal {
  return {
    tenantFirstName: 'Jean',
    title: 'Ma porte ne ferme plus correctement',
    description: 'La porte du salon frotte contre le sol depuis quelques jours',
    tenantMessage: 'La porte du salon frotte contre le sol',
    sessionMessages: [],
    interlocutor: 'tenant',
    signalementBlock: '--- Signalement locataire ---\nPorte salon qui frotte.',
    visualPerceptionRaw: null,
    visionModel: null,
    signalQuality: 7,
    signalQualityFactors: {
      textCoherence: 7,
      textAmbiguityPenalty: 0,
      imageQuality: 0,
      hasImage: false,
      perceptionAvailable: false,
    },
    meta: {
      role: 'tenant',
      textFieldsNormalized: 1,
      imageProcessed: false,
    },
    ...overrides,
  };
}

/** Signal eau + électricité — test danger T2 sans fixture infiltration. */
export function buildEauElectriciteSignal(
  overrides: Partial<PreprocessedSignal> = {},
): PreprocessedSignal {
  return buildGenericTenantSignal({
    title: "gouttes d'eau près de l'ampoule",
    description: "gouttes d'eau sur l'ampoule du plafond du couloir",
    tenantMessage: "gouttes d'eau sur l'ampoule du plafond",
    visualPerceptionRaw: 'ampoule au plafond, traces humides autour du luminaire',
    visionModel: 'pixtral',
    signalQuality: 8,
    signalQualityFactors: {
      textCoherence: 8,
      textAmbiguityPenalty: 0,
      imageQuality: 6,
      hasImage: true,
      perceptionAvailable: true,
    },
    meta: {
      role: 'tenant',
      textFieldsNormalized: 1,
      imageProcessed: true,
    },
    ...overrides,
  });
}
