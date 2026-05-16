import { apiClient } from './apiClient';
import type { ReferentReclamationsResponse } from '@/types/agent';

export const agentApi = {
  getReclamations: (onlyOpen = true) =>
    apiClient
      .get<ReferentReclamationsResponse>('/agents/me/reclamations', {
        params: { onlyOpen: onlyOpen ? 'true' : 'false' },
      })
      .then((r) => r.data),
};
