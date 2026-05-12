/** Profil bailleur social / administrateur de parc — alignement futur API Nest. */
export interface Bailleur {
  id: string;
  corporateName: string;
  siren?: string;
  contactEmail: string;
  /** Présence d’un service GPA interne au moins sur une résidence */
  hasGPACapacity: boolean;
  createdAt: string;
}
