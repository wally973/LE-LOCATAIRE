import { apiClient } from './apiClient';
import type { DossierLookupResult } from '@/types/bailleur';

export type TicketStatusUi =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CANCELLED';

export const ticketsApi = {
  getMine: () => apiClient.get('/tickets/me').then((r) => r.data),
  getOne: (id: number) =>
    apiClient.get(`/tickets/${id}`).then((r) => r.data),
  getMessages: (id: number) =>
    apiClient.get(`/tickets/${id}/messages`).then((r) => r.data),
  create: (body: {
    title: string;
    description: string;
    housingId: number;
  }) => apiClient.post('/tickets', body).then((r) => r.data),
  update: (
    id: number,
    body: Partial<{
      title: string;
      description: string;
      status: TicketStatusUi;
    }>,
  ) => apiClient.patch(`/tickets/${id}`, body).then((r) => r.data),

  /** Recherche par numéro d'affaire AFF-… */
  lookupByCase: (caseNumber: string) =>
    apiClient
      .get<DossierLookupResult>(
        `/tickets/lookup/case/${encodeURIComponent(caseNumber.trim())}`,
      )
      .then((r) => r.data),

  /** Recherche par dossier locataire DOS-… */
  lookupByDossier: (dossierNumber: string) =>
    apiClient
      .get<DossierLookupResult>(
        `/tickets/lookup/dossier/${encodeURIComponent(dossierNumber.trim())}`,
      )
      .then((r) => r.data),
};
