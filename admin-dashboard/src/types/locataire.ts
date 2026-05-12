export interface TenantDashboardResponse {
  profile: { firstName: string; lastName: string };
  housing: {
    id: number;
    address: string;
    city: string;
    postalCode: string;
    landlord?: { id: number; name: string };
  } | null;
  stats: {
    openTickets: number;
    totalTickets: number;
    quittanceCount: number;
  };
}

export type TenantPaymentRow = {
  id: number;
  kind: 'QUITTANCE_LOYER';
  status: 'AVAILABLE' | 'PENDING' | string;
  createdAt: string;
  label: string;
  fileName?: string;
};

export type TenantPaymentDetail = TenantPaymentRow & {
  content: string | null;
  housingId: number | null;
};

export type TenantTicketRow = {
  id: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  housing?: { id: number; address: string };
};

export type AvatarExpression =
  | 'neutral'
  | 'help'
  | 'alert'
  | 'confirm'
  | 'explain';
