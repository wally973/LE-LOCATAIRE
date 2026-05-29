import axios from 'axios';
import { apiClient, getErrorMessage } from './apiClient';

/** Langues proposées au locataire (choix explicite). */
export const LAB_DIALOGUE_LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'gcf', label: 'Créole guyanais' },
  { code: 'en', label: 'Anglais' },
  { code: 'pt', label: 'Portugais (Brésil)' },
  { code: 'es', label: 'Espagnol (Caraïbes)' },
  { code: 'hat', label: 'Créole haïtien' },
] as const;

export type LabDialogueLanguage = (typeof LAB_DIALOGUE_LANGUAGES)[number]['code'];

export interface LiaLabVisualization {
  mentalModels: string[];
  activeFlows: string[];
  activeFlowLabels?: string[];
  detectedLot: string;
  urgencyMode: string | null;
  language: LabDialogueLanguage;
  dialogueLanguageLabel?: string;
  consoleLanguage?: 'fr';
  jarvisFacts: Record<string, string>;
  jarvisFactsConsole?: { label: string; value: string }[];
  visualizationNote: string | null;
  kbPanneId: string | null;
  kbPanneLabel: string | null;
  kbCausesActive: string[];
  kbCausesEliminated: string[];
  afpolRefs: string[];
  intakePhase: string;
  intakePhaseLabel?: string;
  handoffRecommended: boolean;
  tenantLanguage?: string;
  tenantLanguageLabel?: string;
  simulationDomain?: string | null;
  simulationDomainLabel?: string | null;
  scene3D?: Record<string, string | null>;
  scene3DRows?: { label: string; value: string }[];
  physicalHypotheses?: string[];
  councilEchoes?: { agent: string; heard: string; insight: string }[];
  housingPerspective?: string | null;
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

const LAB_REQUEST_TIMEOUT_MS = 30_000;

/** Message d’erreur explicite pour Lia-Lab (auth, backend, rôle). */
export function getLabErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 401) {
      return 'Session expirée ou non connecté — déconnectez-vous puis reconnectez-vous avec un compte ADMIN.';
    }
    if (status === 403) {
      return 'Lia-Lab est réservé aux comptes ADMIN.';
    }
    if (!err.response) {
      return 'Backend injoignable — lancez le backend (npm run start:dev) sur http://localhost:3000.';
    }
  }
  return getErrorMessage(err, fallback);
}

export async function createLabSession(body: {
  title: string;
  description: string;
  tenantFirstName?: string;
}): Promise<LabSessionView> {
  const { data } = await apiClient.post<LabSessionView>('/lia-lab/sessions', body, {
    timeout: LAB_REQUEST_TIMEOUT_MS,
  });
  return data;
}

/** Crée la session + ouverture Jarvis (un seul appel). */
export async function startLabSession(body: {
  title: string;
  description: string;
  tenantFirstName?: string;
  language?: LabDialogueLanguage;
  residenceUnitNumber?: string;
}): Promise<LabSessionView> {
  const { data } = await apiClient.post<LabSessionView>('/lia-lab/sessions/start', body, {
    timeout: LAB_REQUEST_TIMEOUT_MS,
  });
  return data;
}

export async function runLabOpening(sessionId: string): Promise<LabSessionView> {
  const { data } = await apiClient.post<LabSessionView>(
    `/lia-lab/sessions/${sessionId}/opening`,
    undefined,
    { timeout: LAB_REQUEST_TIMEOUT_MS },
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
    { timeout: LAB_REQUEST_TIMEOUT_MS },
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
  language?: LabDialogueLanguage,
): Promise<{ audioBase64: string; mimeType: string }> {
  const { data } = await apiClient.post<{ audioBase64: string; mimeType: string }>(
    '/lia-lab/tts',
    { text, language },
  );
  return data;
}
