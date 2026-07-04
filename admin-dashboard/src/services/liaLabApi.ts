import axios from 'axios';
import { apiClient, getErrorMessage } from './apiClient';

export const LAB_DIALOGUE_LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'gcf', label: 'Créole guyanais' },
  { code: 'en', label: 'Anglais' },
  { code: 'pt', label: 'Portugais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'hat', label: 'Créole haïtien' },
] as const;

export type LabDialogueLanguage = (typeof LAB_DIALOGUE_LANGUAGES)[number]['code'];

export interface GrockTicketHistoryRow {
  caseNumber: string | null;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  daysAgo: number;
}

export interface GrockLabMessage {
  role: 'tenant' | 'grock';
  text: string;
  at: string;
  imagePreview?: string;
}

export interface GrockLabSessionView {
  sessionId: string;
  title: string;
  description: string;
  tenantFirstName: string;
  language: string;
  messages: GrockLabMessage[];
  ticketHistory: GrockTicketHistoryRow[];
  model: string | null;
  groqConfigured: boolean;
  visualPerception: string | null;
  visionModel: string | null;
  thinking: string | null;
  state: string | null;
  nextAction: string | null;
}

export interface GrockVisualization {
  agent: string;
  model: string;
  visionModel?: string | null;
  ticketHistoryCount: number;
  ticketHistory: GrockTicketHistoryRow[];
  messageCount: number;
  visualPerception?: string | null;
  thinking?: string | null;
  state?: string | null;
  nextAction?: string | null;
  perceptionTitle?: string;
  note: string;
}

export interface GrockPathologyAnswerView {
  answer: string;
  model: string;
  language: string;
}

const LAB_REQUEST_TIMEOUT_MS = 120_000;

export function getLabErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const msg = (error.response?.data as { message?: string | string[] })?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (error.code === 'ECONNABORTED') {
      return 'Grock met trop de temps — réessayez (quota Groq ou réseau).';
    }
  }
  return getErrorMessage(error, fallback);
}

export async function startGrockLabSession(body: {
  title: string;
  description: string;
  tenantFirstName?: string;
  language?: LabDialogueLanguage;
}): Promise<GrockLabSessionView> {
  const { data } = await apiClient.post<GrockLabSessionView>(
    '/lia-lab/sessions/start',
    body,
    { timeout: LAB_REQUEST_TIMEOUT_MS },
  );
  return data;
}

export async function sendGrockLabMessage(
  sessionId: string,
  text: string,
): Promise<GrockLabSessionView> {
  const { data } = await apiClient.post<GrockLabSessionView>(
    `/lia-lab/sessions/${sessionId}/message`,
    { text },
    { timeout: LAB_REQUEST_TIMEOUT_MS },
  );
  return data;
}

export async function sendGrockLabPhoto(
  sessionId: string,
  file: File,
  caption?: string,
): Promise<GrockLabSessionView> {
  const form = new FormData();
  form.append('photo', file, file.name || 'photo.jpg');
  if (caption?.trim()) form.append('caption', caption.trim());
  const { data } = await apiClient.post<GrockLabSessionView>(
    `/lia-lab/sessions/${sessionId}/photo`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: LAB_REQUEST_TIMEOUT_MS,
    },
  );
  return data;
}

export async function discardGrockLabSession(sessionId: string): Promise<void> {
  await apiClient.post(`/lia-lab/sessions/${sessionId}/discard`);
}

export async function fetchGrockVisualization(sessionId: string): Promise<GrockVisualization> {
  const { data } = await apiClient.get<GrockVisualization>(
    `/lia-lab/sessions/${sessionId}/visualization`,
    { timeout: LAB_REQUEST_TIMEOUT_MS },
  );
  return data;
}

export async function transcribeLabAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, 'lab.webm');
  const { data } = await apiClient.post<{ text: string }>('/lia-lab/transcribe', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: LAB_REQUEST_TIMEOUT_MS,
  });
  return data.text ?? '';
}

export async function synthesizeLabSpeech(
  text: string,
  language: LabDialogueLanguage = 'fr',
): Promise<{ audioBase64: string; mimeType: string }> {
  const { data } = await apiClient.post<{ audioBase64: string; mimeType: string }>(
    '/lia-lab/tts',
    { text, language },
    { timeout: LAB_REQUEST_TIMEOUT_MS },
  );
  return data;
}

export async function purgeLabLivingState(): Promise<{
  ticketsPurged: number;
  sessionsCleared: number;
}> {
  const { data } = await apiClient.post<{ ticketsPurged: number; sessionsCleared: number }>(
    '/lia-lab/admin/purge-living-state',
    undefined,
    { timeout: LAB_REQUEST_TIMEOUT_MS },
  );
  return data;
}

export async function askGrockPathology(
  question: string,
  language: LabDialogueLanguage = 'fr',
): Promise<GrockPathologyAnswerView> {
  const { data } = await apiClient.post<GrockPathologyAnswerView>(
    '/lia-lab/pathology/ask',
    { question, language },
    { timeout: LAB_REQUEST_TIMEOUT_MS },
  );
  return data;
}
