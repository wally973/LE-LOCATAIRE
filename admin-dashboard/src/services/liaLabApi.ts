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
  /** Safety Override — bouclier arc électrique */
  safetyOverride?: {
    forceKind: string;
    priority: string;
    shieldStatus: string;
    shieldDelivered: boolean;
    surgicalProbe: string | null;
    ticketSummary: string | null;
    investigationPhase: string | null;
  } | null;
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
  livingBuildingState?: unknown;
  livingStateConsole?: { label: string; value: string }[];
  councilEchoes?: { agent: string; heard: string; insight: string }[];
  housingPerspective?: string | null;
  savoirSources?: {
    agent: string;
    agentLabel: string;
    corpus: string;
    ref: string;
    title: string;
    url?: string;
    label: string;
    relevance: number;
    hypothesisLabel?: string;
  }[];
  consciousnessConsole?: { label: string; value: string }[];
  symmetricConsole?: { label: string; value: string }[];
  instrumentsPilotBrief?: string | null;
  guardianConsole?: { label: string; value: string }[];
  guardianMurmures?: string[];
  teamSymbiosis?: {
    charter: string;
    agents: { role: string; label: string; mission: string; lastInsight: string }[];
    dossierSealed: boolean;
    primaryTrade: string | null;
  };
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
  bridgeStatus?: {
    livingIntelligenceEnabled: boolean;
    reasoningSource: string | null;
  };
}

export interface LabJuridiquePreset {
  id: string;
  label: string;
  title: string;
  description: string;
  housingUnit: string;
  legalThemeId: string;
  perimetre: string;
  tenantTurnHint: string | null;
}

export async function fetchLabJuridiquePresets(): Promise<LabJuridiquePreset[]> {
  const { data } = await apiClient.get<{ presets: LabJuridiquePreset[] }>(
    '/lia-lab/presets/juridique',
    { timeout: LAB_REQUEST_TIMEOUT_MS },
  );
  return data.presets ?? [];
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

export interface LabPromptPreview {
  sessionId: string;
  generatedAt: string;
  tenantFirstName: string;
  mode: 'opening' | 'tenant_turn';
  messageContext: string;
  llmBridgeEnabled: boolean;
  systemPrompt: string;
  sections: {
    identity: string;
    missionJarvis: string;
    teamBrief: string;
    investigationProtocol: string;
    jsonRules: string;
    visualLogic: string;
  };
  sectionLabels: Record<string, string>;
}

export async function discardLabSession(sessionId: string): Promise<void> {
  await apiClient.post(`/lia-lab/sessions/${sessionId}/discard`);
}

export async function fetchLabDeliberationPreview(sessionId: string): Promise<{
  sessionId: string;
  models: { majordome: string; enqueteur: string; archiviste: string };
  deliberationEchoes: { agent: string; model: string; insight: string }[];
  livingState: unknown;
}> {
  const { data } = await apiClient.get(
    `/lia-lab/sessions/${sessionId}/deliberation-preview`,
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
