import { apiClient } from './apiClient';

export interface LiaLabVisualization {
  mentalModels: string[];
  activeFlows: string[];
  detectedLot: string;
  urgencyMode: string | null;
  language: string;
  jarvisFacts: Record<string, string>;
  visualizationNote: string | null;
  kbPanneId: string | null;
  kbPanneLabel: string | null;
  kbCausesActive: string[];
  kbCausesEliminated: string[];
  afpolRefs: string[];
  intakePhase: string;
  handoffRecommended: boolean;
}

export interface LabChatMessage {
  role: 'tenant' | 'lia';
  text: string;
  at: string;
  uiStatusLabel?: string;
}

export interface LabSessionView {
  sessionId: string;
  title: string;
  description: string;
  tenantFirstName: string;
  messages: LabChatMessage[];
  visualization: LiaLabVisualization;
}

export async function createLabSession(body: {
  title: string;
  description: string;
  tenantFirstName?: string;
}): Promise<LabSessionView> {
  const { data } = await apiClient.post<LabSessionView>('/lia-lab/sessions', body);
  return data;
}

export async function runLabOpening(sessionId: string): Promise<LabSessionView> {
  const { data } = await apiClient.post<LabSessionView>(
    `/lia-lab/sessions/${sessionId}/opening`,
  );
  return data;
}

export async function sendLabMessage(
  sessionId: string,
  text: string,
): Promise<LabSessionView> {
  const { data } = await apiClient.post<LabSessionView>(
    `/lia-lab/sessions/${sessionId}/message`,
    { text },
  );
  return data;
}

export async function transcribeLabAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, 'lia-lab.webm');
  const { data } = await apiClient.post<{ text: string }>('/lia-lab/transcribe', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.text ?? '';
}

export async function synthesizeLabSpeech(
  text: string,
  language?: 'fr' | 'gcf',
): Promise<{ audioBase64: string; mimeType: string }> {
  const { data } = await apiClient.post<{ audioBase64: string; mimeType: string }>(
    '/lia-lab/tts',
    { text, language },
  );
  return data;
}
