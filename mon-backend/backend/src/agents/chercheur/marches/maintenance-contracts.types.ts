/**
 * Types — knowledge/maintenance-contracts.json
 */

export interface MaintenanceBpuLine {
  code: string;
  label: string;
  unit: string;
  priceEur: number;
}

export interface MaintenanceContractKpi {
  interventionDelayHoursUrgent: number;
  interventionDelayHoursStandard: number;
  technicalCompliance: string;
  averageCostEur: Record<string, number>;
}

export interface MaintenanceContractEntry {
  contractId: string;
  label: string;
  supplier: string;
  lot: string;
  sourceDocuments: { marchePdf: string; bpuPdf: string };
  kpi: MaintenanceContractKpi;
  bpuSamples: MaintenanceBpuLine[];
  hypothesisIds: string[];
  categories: string[];
  keywords: string[];
}

export interface MaintenanceHypothesisMapping {
  leadingHypothesisId: string;
  contractId: string;
  lot: string;
  priority: number;
}

export interface MaintenanceContractsCatalog {
  version: number;
  updatedAt: string;
  description?: string;
  contracts: MaintenanceContractEntry[];
  hypothesisMappings: MaintenanceHypothesisMapping[];
}

/** Résultat du mapping diagnostic → marché. */
export interface MaintenanceContractMatch {
  leadingHypothesisId: string;
  contractId: string;
  contract: MaintenanceContractEntry;
  mapping: MaintenanceHypothesisMapping;
  urgent: boolean;
}
