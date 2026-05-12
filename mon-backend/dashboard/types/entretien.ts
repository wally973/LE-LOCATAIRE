export type MaintenanceFrequency = "mensuel" | "trimestriel" | "annuel";

/** Types d’équipement / périmètres obligatoires (Module 2 & 3) */
export type EntretienTypeCode =
  | "VMC"
  | "CHAUFFE_EAU_SOLAIRE"
  | "SIPHONS"
  | "RADIATEURS"
  | "JOINTS"
  | "AERATIONS"
  | "CAPTEURS_SOLAIRES"
  | "EXTERIEUR_PRIVATIF"
  /** Sous-modules espaces verts / dalle / évacuations */
  | "EXT_COUR"
  | "EXT_JARDIN"
  | "EXT_TERRASSE"
  | "EXT_PATIO";

export interface EntretienType {
  code: EntretienTypeCode;
  labelFr: string;
  descriptionFr?: string;
  frequency: MaintenanceFrequency;
  requiresOutdoorProof: boolean;
}

/** Plan d’entretien rattaché à un logement + équipements présents */
export interface LogementEntretienPlan {
  id: string;
  logementId: string;
  /** Code catalogue API (enum Prisma côté backend, peut évoluer). */
  entretienTypeCode: string;
  /** Prochain échéance (ISO date) — calcul ou fourni par API */
  nextDueAt: string;
  lastCompletedAt?: string;
}

export type ProofPhotoRole = "NETTOYAGE" | "ETAT_FINAL";

export interface EntretienPreuve {
  id: string;
  planId: string;
  checklistSnapshot: Record<string, boolean>;
  photoCleaningUrl?: string;
  photoFinalStateUrl?: string;
  /** Validé métier après preuves + règles (IA optionnel plus tard) */
  validatedAt?: string;
  /** Refus automatique tant que les deux photos manquent */
  isComplete: boolean;
  submittedAt: string;
}

export type OutdoorPrivateFeature =
  | "cour"
  | "jardin"
  | "terrasse"
  | "patio";
