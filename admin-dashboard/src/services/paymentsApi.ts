/**
 * Module paiements — structure prête pour Stripe (historique, relances).
 * Les endpoints backend globaux locataire pourront être branchés ici.
 */
export const paymentsApi = {
  /** Placeholder jusqu’à endpoints tenant dédiés */
  async listTenantPlaceholder(): Promise<{ message: string }> {
    return {
      message:
        'Historique des loyers : branchement API à venir (Stripe / facturation).',
    };
  },
};
