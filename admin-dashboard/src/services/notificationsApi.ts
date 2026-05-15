import { apiClient } from './apiClient';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationSettings {
  userId: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
}

export const notificationsApi = {
  getMine: () =>
    apiClient.get<AppNotification[]>('/notifications/me').then((r) => r.data),

  getSettings: () =>
    apiClient
      .get<NotificationSettings>('/notifications/me/settings')
      .then((r) => r.data),

  updateSettings: (payload: Partial<Pick<NotificationSettings, 'emailEnabled' | 'pushEnabled'>>) =>
    apiClient
      .patch<NotificationSettings>('/notifications/me/settings', payload)
      .then((r) => r.data),

  registerDeviceToken: (token: string, platform: 'android' | 'ios' | 'web') =>
    apiClient
      .post('/notifications/me/device-tokens', { token, platform })
      .then((r) => r.data),

  markAsRead: (id: number) =>
    apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
};

/** Jeton web dev tant que FCM web n’est pas branché. */
export function getOrCreateWebPushToken(): string {
  const key = 'le_locataire_web_push_token';
  let token = localStorage.getItem(key);
  if (!token) {
    token = `web-dev-${crypto.randomUUID()}`;
    localStorage.setItem(key, token);
  }
  return token;
}

export async function syncWebPushTokenAfterLogin(): Promise<void> {
  const token = getOrCreateWebPushToken();
  await notificationsApi.registerDeviceToken(token, 'web');
}
