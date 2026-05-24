import { apiClient } from './apiClient';

export interface ProBriefingCritical {
  model: string | null;
  symptoms: string[];
  category: string;
  categoryLabel: string;
  severity: string | null;
  confidence: number | null;
  responsibility: string | null;
  roomHint: string | null;
  safetyLevel: string | null;
  artisanType: string | null;
  photoCount: number;
  intakePhase: string | null;
}

export interface SavoirVoirStep {
  order: number;
  name: string;
  what: string;
  technicianRole: string;
}

export interface SavoirVoirMethodBrief {
  title: string;
  tagline: string;
  steps: SavoirVoirStep[];
  commitments: string[];
  references: string[];
}

export interface ProBriefingResearch {
  tradeFiche: string;
  searchTrigger: string | null;
  intakeSummary: string;
  similarCases: string[];
  juristRationale: string | null;
  pipelineTrace: string[];
}

export interface ProBriefing {
  ticketId: number;
  caseNumber: string | null;
  title: string;
  description: string;
  status: string;
  housingAddress: string | null;
  generatedAt: string;
  narrativeSummary: string;
  critical: ProBriefingCritical;
  research: ProBriefingResearch;
  diagnosticMessage: string | null;
  diagnosticAuthority: 'AI_PROPOSED' | 'EXPERT_VALIDATED';
  expertCorrection: {
    expertName: string;
    correctedDiagnosis: string;
    reason: string;
    modelHint: string | null;
    correctedAt: string;
    responsibility: string | null;
    specialHandling: string[];
    vulnerableDetail: string | null;
    takeCharge: boolean;
  } | null;
  fromLlm: boolean;
  savoirVoir: SavoirVoirMethodBrief;
}

export interface ProBriefingAskResult {
  question: string;
  answer: string;
  fromLlm: boolean;
  contextHint: string;
}

export interface ProBriefingChatEntry {
  question: string;
  answer: string;
  fromLlm: boolean;
}

export const proBriefingApi = {
  get: (ticketId: number) =>
    apiClient
      .get<ProBriefing>(`/tickets/${ticketId}/pro-briefing`)
      .then((r) => r.data),

  ask: (ticketId: number, question: string) =>
    apiClient
      .post<ProBriefingAskResult>(`/tickets/${ticketId}/pro-briefing/ask`, {
        question,
      })
      .then((r) => r.data),

  rectify: (
    ticketId: number,
    body: {
      correctedDiagnosis: string;
      reason: string;
      modelHint?: string;
      responsibility: string;
      specialHandling?: Array<
        'STRUCTURAL_INFILTRATION' | 'VULNERABLE_TENANT'
      >;
      vulnerableDetail?: string;
      takeCharge?: boolean;
    },
  ) =>
    apiClient
      .post<{
        ticketId: number;
        authority: string;
        messageForTenant: string;
      }>(`/tickets/${ticketId}/expert-rectification`, body)
      .then((r) => r.data),
};
