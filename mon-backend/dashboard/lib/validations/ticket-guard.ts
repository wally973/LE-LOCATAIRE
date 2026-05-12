import type { TicketCategoryHint } from "@/types";

const OUTDOOR_RELATED: TicketCategoryHint[] = [
  "MOUSTIQUES",
  "NUISIBLE",
  "EVACUATION",
  "INFILTRATION",
  "ODEUR",
];

const DEFAULT_MAINTENANCE_FRESHNESS_DAYS = 90;

export interface TenantMaintenanceGateState {
  /** Preuves conformes (cases + 2 photos) */
  proofsValid: boolean;
  /** Cohérence basique (pour extension validation IA) */
  photosCoherent: boolean;
  /** Dernière soumission de preuve complète */
  lastCompleteProofAt?: string;
  /** Entretien espaces extérieurs privatifs à jour (Module 3) */
  outdoorProofsCompliant?: boolean;
}

function daysSince(iso?: string): number | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

export function shouldBlockTicket(
  gate: TenantMaintenanceGateState,
  incidentCategory?: TicketCategoryHint,
): { blocked: boolean; reason?: string } {
  if (!gate.proofsValid) {
    return { blocked: true, reason: "PROOFS_MISSING" };
  }
  if (!gate.photosCoherent) {
    return { blocked: true, reason: "PHOTOS_INCOHERENT" };
  }
  const elapsed = daysSince(gate.lastCompleteProofAt);
  if (elapsed === undefined || elapsed > DEFAULT_MAINTENANCE_FRESHNESS_DAYS) {
    return { blocked: true, reason: "MAINTENANCE_NOT_RECENT" };
  }
  if (
    incidentCategory &&
    OUTDOOR_RELATED.includes(incidentCategory) &&
    gate.outdoorProofsCompliant === false
  ) {
    return { blocked: true, reason: "OUTDOOR_MAINTENANCE_REQUIRED" };
  }
  return { blocked: false };
}
