export type WarrantyPhase =
  | "GPA_ACTIVE"
  | "BIENNALE_ACTIVE"
  | "DECENNALE_ACTIVE"
  | "POST_WARRANTY";

export interface GPAService {
  id: string;
  residenceId: string;
  bailleurId: string;
  /** Actif tant que nous sommes avant gpaEndDate et que le bailleur expose le service */
  enabled: boolean;
  phone?: string;
  email?: string;
}
