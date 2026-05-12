import { apiClient } from './apiClient';

export type TicketStatusUi =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CANCELLED';

export const ticketsApi = {
  getMine: () => apiClient.get('/tickets/me').then((r) => r.data),
  getOne: (id: number) =>
    apiClient.get(`/tickets/${id}`).then((r) => r.data),
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
};
