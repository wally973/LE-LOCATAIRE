/**
 * API métier espace bailleur — méthodes nommées demandées par le produit.
 * S’appuie sur les routes Nest existantes (/landlords/me/*, /tickets, /invoice/*).
 */
import { landlordApi } from './landlordApi';
import { ticketsApi, type TicketStatusUi } from './ticketsApi';
import { invoiceApi } from './invoiceApi';
import type {
  BailleurHousing,
  BailleurInvoice,
  BailleurStats,
  BailleurTenantWithHousing,
  BailleurTicket,
  LandlordDashboard,
  TicketResponsibilityUi,
} from '../types/bailleur';

function normalizeHousings(raw: unknown): BailleurHousing[] {
  return Array.isArray(raw) ? (raw as BailleurHousing[]) : [];
}

function normalizeTickets(raw: unknown): BailleurTicket[] {
  return Array.isArray(raw) ? (raw as BailleurTicket[]) : [];
}

export async function getMyHousings(): Promise<BailleurHousing[]> {
  const raw = await landlordApi.getMyHousings();
  return normalizeHousings(raw);
}

/** Locataires actuellement liés à au moins un des logements du bailleur */
export async function getMyTenants(): Promise<BailleurTenantWithHousing[]> {
  const housings = await getMyHousings();
  const rows: BailleurTenantWithHousing[] = [];
  for (const h of housings) {
    if (h.currentTenant) {
      rows.push({
        tenant: h.currentTenant,
        housing: {
          id: h.id,
          address: h.address,
          city: h.city,
          postalCode: h.postalCode,
        },
      });
    }
  }
  return rows;
}

export async function getMyPayments(): Promise<BailleurInvoice[]> {
  const raw = await invoiceApi.listLandlordInvoices();
  return Array.isArray(raw) ? (raw as BailleurInvoice[]) : [];
}

/** Tickets du parc (route enrichie côté landlords) */
export async function getMyTickets(
  responsibility?: TicketResponsibilityUi,
): Promise<BailleurTicket[]> {
  const raw = await landlordApi.getMyTickets(
    responsibility ? { responsibility } : undefined,
  );
  return normalizeTickets(raw);
}

export async function getLandlordDashboard(): Promise<LandlordDashboard> {
  return landlordApi.getDashboard() as Promise<LandlordDashboard>;
}

export async function updateTicketStatus(
  id: number,
  status: TicketStatusUi,
): Promise<unknown> {
  return ticketsApi.update(id, { status });
}

export async function updateBailleurProfile(
  body: Record<string, unknown>,
): Promise<unknown> {
  return landlordApi.updateProfile(body);
}

export async function getBailleurStats(): Promise<BailleurStats> {
  const d = await getLandlordDashboard();
  return {
    housingCount: d.stats.housingCount,
    tenantCount: d.stats.tenantCount,
    openTickets: d.stats.openTickets,
    invoiceTotal: d.stats.invoices.total,
    invoicePaid: d.stats.invoices.paid,
    invoicePending: d.stats.invoices.pending,
  };
}

/** Réponse bailleur sur un ticket : concatène la description (pas de route commentaires dédiée). */
export async function replyToTicket(id: number, message: string): Promise<unknown> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Message vide');
  const t = await ticketsApi.getOne(id);
  const stamp = new Date().toLocaleString('fr-FR');
  const block = `\n\n--- Réponse bailleur (${stamp}) ---\n${trimmed}`;
  const desc =
    typeof (t as { description?: string }).description === 'string'
      ? (t as { description: string }).description
      : '';
  return ticketsApi.update(id, { description: `${desc}${block}` });
}

export const bailleurApi = {
  getMyHousings,
  getMyTenants,
  getMyPayments,
  getMyTickets,
  getLandlordDashboard,
  updateTicketStatus,
  updateBailleurProfile,
  getBailleurStats,
  replyToTicket,
};
