/**
 * Contrat frontend “IA-ready” — à mapper sur les routes Nest existantes ou futures.
 * Base URL depuis NEXT_PUBLIC_API_URL.
 */
const base = () =>
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "";

export const aiMaintenanceEndpoints = {
  /** Score / validation automatique après upload pré-labélisée */
  validateMaintenanceProofs: `${base()}/ai/maintenance/validate-proofs`,
  /** Détection anomalies simples entre deux images (stub backend) */
  analyzeProofImages: `${base()}/ai/maintenance/analyze-images`,
  /** Auto-diagnostic entretien (checklist → risques) */
  autoDiagnoseMaintenance: `${base()}/ai/maintenance/diagnose`,
  /** Routage enrichi après ticket + garanties résidence */
  routeTicketSuggestion: `${base()}/ai/tickets/route-suggestion`,
} as const;

export type ValidateProofPayload = {
  planId: string;
  checklistKeys: string[];
  photoCleaningUrl: string;
  photoFinalStateUrl: string;
};
