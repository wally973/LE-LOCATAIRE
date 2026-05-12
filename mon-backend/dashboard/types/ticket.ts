export type TicketStatus =
  | "BROUILLON"
  | "OUVERT"
  | "EN_COURS"
  | "RESOLU"
  | "BLOQUE_ENTRETIEN";

export type TicketCategoryHint =
  | "MOUSTIQUES"
  | "NUISIBLE"
  | "EVACUATION"
  | "INFILTRATION"
  | "ODEUR"
  | "AUTRE";

export interface Ticket {
  id: string;
  logementId: string;
  /** Présent si jointure résidence côté API ; sinon déduit via logement. */
  residenceId?: string;
  title: string;
  description?: string;
  status: TicketStatus;
  categoryHint?: TicketCategoryHint;
  blockedReason?: string;
  routingLabelFr?: string;
  createdAt: string;
}
