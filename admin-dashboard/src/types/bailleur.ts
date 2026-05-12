import type { TicketStatusUi } from '@services/ticketsApi';

/** Logement renvoyé par GET /landlords/me/housings */
export interface BailleurHousing {
  id: number;
  address: string;
  city: string;
  postalCode: string;
  isValidated?: boolean;
  createdAt?: string;
  currentTenant?: BailleurTenant | null;
  tickets?: { id: number; status: string }[];
}

export interface BailleurTenant {
  id: number;
  firstName: string;
  lastName: string;
  userId: number;
  housingId: number | null;
  user?: { email: string | null; phone: string } | null;
}

export interface BailleurTenantWithHousing {
  tenant: BailleurTenant;
  housing: {
    id: number;
    address: string;
    city: string;
    postalCode: string;
  };
}

export interface BailleurInvoice {
  id: number;
  amount: number;
  status: string;
  createdAt: string;
  landlordId: number;
  slot: {
    id: number;
    startDate: string;
    endDate: string;
    ticket: {
      id: number;
      housing: {
        id: number;
        address: string;
        city: string;
        postalCode: string;
      } | null;
    } | null;
    artisan: { id: number; email: string | null } | null;
  };
}

export interface BailleurTicket {
  id: number;
  title: string;
  description: string;
  status: TicketStatusUi | string;
  createdAt: string;
  updatedAt?: string;
  housing?: {
    id: number;
    address: string;
    city?: string;
  } | null;
  tenant?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
}

export interface BailleurStats {
  housingCount: number;
  tenantCount: number;
  openTickets: number;
  invoiceTotal: number;
  invoicePaid: number;
  invoicePending: number;
}
