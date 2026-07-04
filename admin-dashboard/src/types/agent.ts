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
  aiSeverity: string | null;
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

/** Message GET /tickets/:id/messages */
export interface TicketMessageRow {
  id: number;
  ticketId: number;
  role: 'TENANT' | 'LIA_HOST' | 'LIA_SYSTEM' | string;
  content: string;
  locale: string;
  createdAt: string;
}
