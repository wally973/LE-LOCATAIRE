/**
 * Types — fiches passives Savoir-Voir (master-diagnostic-rules.json v2).
 */

export interface PassiveSavoirFiche {
  id: string;
  lot: string;
  label: string;
  keywords: string[];
  signesUtiles?: string[];
  pistesConnues?: Array<{ label: string; chargeHint: string }>;
  notesTerrain?: string[];
  signesUrgence?: string[];
  messageSecurite?: string | null;
  /** Fiches panne-diagnostic */
  scope?: string;
  contexteGuyane?: string;
  causesConnues?: Array<{
    id: string;
    label: string;
    probabiliteTerrain?: number | null;
    signesDiscriminants?: string;
    danger: { level: string; description: string };
    chargeHint: string;
  }>;
}

export interface PrioriteTerritoriale {
  dominant: string;
  regle: string;
}

export interface PassiveSavoirCatalog {
  schema: 'PASSIVE_KNOWLEDGE_SHEET';
  version?: number;
  schemaVersion?: number;
  updatedAt: string;
  description?: string;
  method?: string;
  prioriteTerritoriale: PrioriteTerritoriale;
  fiches: PassiveSavoirFiche[];
}

/** @deprecated Alias compat moteur diagnostic — même shape que PassiveSavoirFiche */
export type MasterDomainRules = PassiveSavoirFiche & { category: string };

export interface MasterHypothesisResult {
  id: string;
  label: string;
  probability: number;
  responsibilityHint: 'LOCATAIRE' | 'BAILLEUR' | 'NUANCE';
  eliminated?: boolean;
  eliminationReason?: string;
}

export interface MasterDifferentialResult {
  domainId: string;
  domainLabel: string;
  category: string;
  leadingHypothesisId: string;
  hypotheses: MasterHypothesisResult[];
  observation: string;
  responsibilityHint: 'LOCATAIRE' | 'BAILLEUR' | 'NUANCE';
  missingCriticalSensors: string[];
}

export interface MasterDiagnosticCatalog extends PassiveSavoirCatalog {
  /** Compat tests legacy */
  domains?: MasterDomainRules[];
}

export function fichesFromCatalog(catalog: MasterDiagnosticCatalog): PassiveSavoirFiche[] {
  if (catalog.fiches?.length) return catalog.fiches;
  return (catalog.domains ?? []).map((d) => ({
    ...d,
    lot: d.category ?? d.lot,
  }));
}
