/**
 * API espace locataire — alignée sur les routes `/tenant/me/*` et tickets.
 */
import { apiClient } from './apiClient';
import { tenantApi } from './tenantApi';
import { ticketsApi } from './ticketsApi';
import type {
  TenantDashboardResponse,
  TenantPaymentDetail,
  TenantPaymentRow,
} from '@/types/locataire';

export async function getTenantDashboard(): Promise<TenantDashboardResponse> {
  const { data } = await apiClient.get<TenantDashboardResponse>(
    '/tenant/me/dashboard',
  );
  return data;
}

export async function getMyPayments(): Promise<TenantPaymentRow[]> {
  const { data } = await apiClient.get<TenantPaymentRow[]>(
    '/tenant/me/payments',
  );
  return Array.isArray(data) ? data : [];
}

export async function getPaymentDetails(
  documentId: number,
): Promise<TenantPaymentDetail> {
  const { data } = await apiClient.get<TenantPaymentDetail>(
    `/tenant/me/payments/${documentId}`,
  );
  return data;
}

export async function getMyTickets(): Promise<unknown> {
  return ticketsApi.getMine();
}

export async function createTicket(body: {
  title: string;
  description: string;
  housingId: number;
}): Promise<unknown> {
  return ticketsApi.create(body);
}

export async function replyToTicket(
  ticketId: number,
  message: string,
): Promise<unknown> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Message vide');
  const t = (await ticketsApi.getOne(ticketId)) as { description?: string };
  const desc = typeof t.description === 'string' ? t.description : '';
  const stamp = new Date().toLocaleString('fr-FR');
  const block = `\n\n--- Réponse locataire (${stamp}) ---\n${trimmed}`;
  return ticketsApi.update(ticketId, { description: `${desc}${block}` });
}

export async function updateTenantProfile(
  body: Record<string, unknown>,
): Promise<unknown> {
  return tenantApi.updateMe(body);
}

export const locataireApi = {
  getTenantDashboard,
  getMyPayments,
  getPaymentDetails,
  getMyTickets,
  createTicket,
  replyToTicket,
  updateTenantProfile,
};
