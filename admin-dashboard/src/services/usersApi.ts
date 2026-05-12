import { apiClient } from './apiClient';

export interface ApiUser {
  id: number;
  email: string | null;
  phone: string;
  role: string;
  createdAt: string;
}

export const usersApi = {
  list: () => apiClient.get<ApiUser[]>('/users').then((r) => r.data),
};
