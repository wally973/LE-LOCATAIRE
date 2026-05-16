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
}
