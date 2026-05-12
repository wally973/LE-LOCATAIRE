import { apiClient } from './apiClient';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export const notificationsApi = {
  getMine: () =>
    apiClient.get<AppNotification[]>('/notifications/me').then((r) => r.data),
};
