/** Ligne GET /agents/me/reclamations */
export interface ReferentReclamationRow {
  id: number;
  caseNumber: string | null;
  dossierNumber: string | null;
  title: string;
  status: string;
  responsibility: string;
  metier: string;
  metierCode: string | null;
  joursSansTraitement: number;
  affichageRetard: string;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: number;
    firstName: string;
    lastName: string;
  };
  housing: {
    id: number;
    address: string;
    city: string;
    postalCode: string;
    agenceName: string | null;
  } | null;
}

export interface ReferentReclamationsResponse {
  agence: { id: number; name: string } | null;
  scopeLabel: string;
  items: ReferentReclamationRow[];
  total: number;
}
