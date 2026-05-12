import type { WarrantyPhase } from "./gpa";

/** Résidence (ensemble de logements). */
export interface Residence {
  id: string;
  name: string;
  bailleurId: string;
  /** Année de construction déclarative */
  constructionYear?: number;
  /** Date de livraison / réception (référence garanties) */
  deliveryDate: string;
  residenceNeuve: boolean;
  /** Service GPA interne au bailleur pour cette résidence ? */
  hasInternalGPAService: boolean;
}

/** Dates calculées côté client ou persistées après sync serveur */
export interface ResidenceWarrantySchedule {
  residenceId: string;
  deliveryDate: string;
  gpaEndDate: string;
  biennaleEndDate: string;
  decennaleEndDate: string;
}

/** Contexte utilisé pour le routage d’un nouveau ticket incident */
export interface TicketRoutingSuggestion {
  phase: WarrantyPhase;
  assignTo: "GPA_INTERNAL_OR_LANDLORD" | "CONSTRUCTOR" | "DECENNALE_INSURER" | "CRAFTSMAN_OR_LANDLORD";
  labelFr: string;
}
