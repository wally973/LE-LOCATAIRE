import { apiClient } from './apiClient';

export const invoiceApi = {
  landlordDashboard: () =>
    apiClient.get('/invoice/dashboard/landlord').then((r) => r.data),
  /** Liste factures bailleur (interventions / artisan) */
  listLandlordInvoices: () =>
    apiClient.get('/invoice/list/landlord').then((r) => r.data),
  getInvoice: (id: number) =>
    apiClient.get(`/invoice/${id}`).then((r) => r.data),
};
