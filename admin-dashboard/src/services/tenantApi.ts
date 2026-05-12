import { apiClient } from './apiClient';

export const tenantApi = {
  getMe: () => apiClient.get('/tenant/me').then((r) => r.data),
  updateMe: (body: Record<string, unknown>) =>
    apiClient.patch('/tenant/me', body).then((r) => r.data),
};
