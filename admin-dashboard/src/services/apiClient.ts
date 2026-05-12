import axios, { AxiosError } from 'axios';
import { getApiBaseUrl } from './apiBase';

/**
 * Client HTTP partagé : préfixe API via `getApiBaseUrl()` (proxy Vite en dev).
 */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ message?: string | string[] }>;
    const m = ax.response?.data?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
    return ax.message || fallback;
  }
  return fallback;
}
