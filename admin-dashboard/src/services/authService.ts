import { parseJwtPayload } from '@auth/jwt';
import { normalizeRole } from '@auth/normalizeRole';
import type { UserRole } from '@auth/roles';
import { apiClient } from './apiClient';
import { syncWebPushTokenAfterLogin } from './notificationsApi';

export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

class AuthService {
  private persistTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    const p = parseJwtPayload(accessToken);
    if (p?.role) {
      const normalized = normalizeRole(String(p.role));
      if (normalized) localStorage.setItem('user_role', normalized);
    }
    if (p?.sub != null) localStorage.setItem('user_id', String(p.sub));
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      '/auth/login',
      credentials,
    );
    const { access_token, refresh_token } = response.data;
    this.persistTokens(access_token, refresh_token);
    try {
      await syncWebPushTokenAfterLogin();
    } catch {
      /* push non bloquant si l’API est indisponible */
    }
    return response.data;
  }

  async logout(): Promise<void> {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRole(): UserRole | null {
    return normalizeRole(localStorage.getItem('user_role'));
  }

  getUserId(): number | null {
    const id = localStorage.getItem('user_id');
    if (!id) return null;
    const n = parseInt(id, 10);
    return Number.isNaN(n) ? null : n;
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

export default new AuthService();
