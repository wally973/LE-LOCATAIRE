import { apiClient } from './apiClient';

export const landlordApi = {
  getProfile: () => apiClient.get('/landlords/me').then((r) => r.data),
  updateProfile: (body: Record<string, unknown>) =>
    apiClient.patch('/landlords/me', body).then((r) => r.data),
  getMyHousings: () =>
    apiClient.get('/landlords/me/housings').then((r) => r.data),
  getMyTickets: () =>
    apiClient.get('/landlords/me/tickets').then((r) => r.data),
  validateHousing: (
    id: number,
    body: { isValidated: boolean; comment?: string },
  ) =>
    apiClient
      .patch(`/landlords/housing/${id}/validate`, body)
      .then((r) => r.data),
};

export const housingApi = {
  create: (body: {
    address: string;
    city: string;
    postalCode: string;
    landlordId: number;
  }) => apiClient.post('/housing', body).then((r) => r.data),
  update: (
    id: number,
    body: Partial<{
      address: string;
      city: string;
      postalCode: string;
    }>,
  ) => apiClient.patch(`/housing/${id}`, body).then((r) => r.data),
  findOne: (id: number) =>
    apiClient.get(`/housing/${id}`).then((r) => r.data),
  findAll: () => apiClient.get('/housing').then((r) => r.data),
  assignTenant: (body: { housingId: number; tenantId: number }) =>
    apiClient.post('/housing/assign', body).then((r) => r.data),
};
