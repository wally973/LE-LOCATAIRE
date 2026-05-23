/** Indices photo humidité (charge bailleur si dégradation structurelle visible). */
export interface HumidityPhotoAssessment {
  /** Fissure, infiltration, salpêtre, cloques étendues, remontée capillaire, etc. */
  structuralDegradationVisible: boolean;
  /** Moisissure de surface / condensation localisée sans atteinte du bâti. */
  tenantSurfaceNeglectOnly: boolean;
  indicators: string[];
}

/** Résultat de l'agent pathologiste (vision + texte). */
export interface PathologistResult {
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  needsMorePhoto: boolean;
  observation: string;
  suggestedArtisanType?: string;
  /** true si Gemini a répondu ; false si mode simulation interne. */
  fromLlm: boolean;
  /** Présent si category HUMIDITY et photo analysée (ou heuristique). */
  humidityPhoto?: HumidityPhotoAssessment;
}
