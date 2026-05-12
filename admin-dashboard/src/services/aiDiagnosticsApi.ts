import { apiClient } from './apiClient';

export interface RecordAiDiagnosticPayload {
  locale: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  target: 'ADMIN' | 'LANDLORD' | 'ARTISAN' | 'NONE';
  refused: boolean;
  refusalReason?: string;
  diagnosticSummary: string;
  pipelineSteps?: Record<string, unknown>;
  avatarVariant?: string;
  artisanType?: string | null;
  bailleurFlag: boolean;
  adminFlag: boolean;
}

export async function recordAiDiagnostic(
  payload: RecordAiDiagnosticPayload,
): Promise<void> {
  await apiClient.post('/ai-diagnostics/record', payload);
}

export async function deleteMyAiDiagnosticHistory(): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete<{ deleted: number }>(
    '/tenant/me/ai-diagnostics',
  );
  return data;
}

export type AdminAiStatsResponse = {
  windowDays: number;
  totals: {
    all: number;
    refused: number;
    accepted: number;
    artisanOriented: number;
    bailleurOriented: number;
    adminOriented: number;
  };
  byLocale: Record<string, number>;
  byCategory: Record<string, number>;
  charts: {
    byHourUtc: { hour: number; count: number }[];
    byDayOfWeekUtc: { day: number; count: number }[];
    byDate: { date: string; count: number }[];
  };
};

export async function fetchAdminAiDiagnosticsStats(): Promise<AdminAiStatsResponse> {
  const { data } = await apiClient.get<AdminAiStatsResponse>(
    '/admin/ai-diagnostics/stats',
  );
  return data;
}
