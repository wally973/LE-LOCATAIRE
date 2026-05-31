import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LiaJarvisPilotService } from '../agents/orchestrateur/intake/lia-jarvis-pilot.service';
import type { LiaIntakeState } from '../agents/orchestrateur/intake/lia-intake.service';
import { loadJarvisJuridiqueTrainingScenarios } from '../agents/orchestrateur/intake/lia-jarvis-training-scenarios.loader';
import { buildLabVisualization, type LiaLabVisualization } from './lia-lab-visualization';

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
  intake: LiaIntakeState;
}

interface LabSession {
  id: string;
  title: string;
  description: string;
  tenantFirstName: string;
  residenceUnitNumber?: string;
  state: LiaIntakeState;
  messages: LabChatMessage[];
}

@Injectable()
export class LiaLabService {
  private readonly logger = new Logger(LiaLabService.name);
  private readonly sessions = new Map<string, LabSession>();

  constructor(private readonly jarvis: LiaJarvisPilotService) {}

  /** Presets entraînement juridique — même source que les tests Jarvis. */
  listJuridiquePresets(): {
    id: string;
    label: string;
    title: string;
    description: string;
    housingUnit: string;
    legalThemeId: string;
    perimetre: string;
    tenantTurnHint: string | null;
  }[] {
    return loadJarvisJuridiqueTrainingScenarios().map((s) => ({
      id: s.id,
      label: s.theme,
      title: s.title,
      description: s.description,
      housingUnit: s.housingUnit,
      legalThemeId: s.legalThemeId,
      perimetre: s.perimetre,
      tenantTurnHint: s.tenantTurn?.message?.trim() ?? null,
    }));
  }

  createSession(params: {
    title: string;
    description: string;
    tenantFirstName?: string;
    language?: string;
    residenceUnitNumber?: string;
  }): LabSessionView {
    const id = randomUUID();
    const state = this.jarvis.bootstrapState(
      params.title,
      params.description,
      params.language ?? 'fr',
      params.residenceUnitNumber,
    );
    const session: LabSession = {
      id,
      title: params.title,
      description: params.description,
      tenantFirstName: params.tenantFirstName?.trim() || 'Marie',
      residenceUnitNumber: params.residenceUnitNumber?.trim(),
      state,
      messages: [],
    };
    this.sessions.set(id, session);
    return this.toView(session);
  }

  /** Crée la session et lance l’ouverture Jarvis en un seul appel (Lia-Lab). */
  async startSession(params: {
    title: string;
    description: string;
    tenantFirstName?: string;
    language?: string;
    residenceUnitNumber?: string;
  }): Promise<LabSessionView> {
    const view = this.createSession(params);
    return this.runOpening(view.sessionId);
  }

  async runOpening(sessionId: string): Promise<LabSessionView> {
    const session = this.getSession(sessionId);
    const turn = await this.jarvis.runOpening({
      state: session.state,
      title: session.title,
      description: session.description,
      tenantFirstName: session.tenantFirstName,
      residenceUnitNumber: session.residenceUnitNumber,
    });
    session.state = turn.state;
    const parts = [turn.acknowledgment, turn.nextQuestion].filter(Boolean) as string[];
    for (const text of parts) {
      session.messages.push({
        role: 'lia',
        text,
        at: new Date().toISOString(),
        uiStatusLabel: turn.uiStatus?.label,
      });
    }
    return this.toView(session);
  }

  async sendTenantMessage(
    sessionId: string,
    text: string,
  ): Promise<LabSessionView> {
    const session = this.getSession(sessionId);
    const trimmed = text.trim();
    if (!trimmed) return this.toView(session);

    session.messages.push({
      role: 'tenant',
      text: trimmed,
      at: new Date().toISOString(),
    });

    const turn = await this.jarvis.runTenantTurn({
      state: session.state,
      message: trimmed,
      title: session.title,
      description: session.description,
      tenantFirstName: session.tenantFirstName,
      residenceUnitNumber: session.residenceUnitNumber,
    });
    session.state = turn.state;

    const liaParts = [turn.acknowledgment, turn.nextQuestion].filter(
      Boolean,
    ) as string[];
    for (const liaText of liaParts) {
      session.messages.push({
        role: 'lia',
        text: liaText,
        at: new Date().toISOString(),
        uiStatusLabel: turn.uiStatus?.label,
      });
    }

    return this.toView(session);
  }

  async transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GROQ_API_KEY manquante — transcription indisponible.',
      );
    }
    const baseUrl =
      process.env.GROQ_AUDIO_BASE_URL ??
      process.env.LIA_HOST_BASE_URL ??
      'https://api.groq.com/openai/v1';

    const ext = mimeType.includes('webm')
      ? 'webm'
      : mimeType.includes('mp4')
        ? 'mp4'
        : 'wav';
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const form = new FormData();
    form.append('file', blob, `lia-lab.${ext}`);
    form.append('model', process.env.GROQ_WHISPER_MODEL ?? 'whisper-large-v3-turbo');
    form.append('language', 'fr');
    form.append('response_format', 'json');

    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      this.logger.warn(`Groq STT HTTP ${res.status}`);
      throw new ServiceUnavailableException(
        `Transcription échouée (HTTP ${res.status}).`,
      );
    }

    const data = (await res.json()) as { text?: string };
    const text = data.text?.trim();
    if (!text) {
      throw new ServiceUnavailableException('Transcription vide.');
    }
    return text;
  }

  async synthesizeSpeech(
    text: string,
    language = 'fr',
  ): Promise<{ audioBase64: string; mimeType: string }> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId =
      process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'ELEVENLABS_API_KEY manquante — synthèse vocale indisponible.',
      );
    }

    const langHints: Record<string, string> = {
      gcf: '[Créole guyanais, ton technicien bienveillant]',
      hat: '[Kreyòl ayisyen, ton technicien bienveillant]',
      en: '[English, calm housing technician]',
      pt: '[Português brasileiro, técnico habitacional calmo]',
      es: '[Español caribeño, técnico habitacional calmado]',
    };
    const hint = langHints[language] ?? '';
    const prompt = hint ? `${hint} ${text}` : text;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: prompt,
          model_id: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!res.ok) {
      this.logger.warn(`ElevenLabs HTTP ${res.status}`);
      throw new ServiceUnavailableException(
        `Synthèse vocale échouée (HTTP ${res.status}).`,
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    return { audioBase64, mimeType: 'audio/mpeg' };
  }

  getVisualization(sessionId: string): LiaLabVisualization {
    const session = this.getSession(sessionId);
    return buildLabVisualization({
      state: session.state,
      title: session.title,
      description: session.description,
      lastMessage: session.messages.filter((m) => m.role === 'tenant').at(-1)
        ?.text,
    });
  }

  private getSession(id: string): LabSession {
    const s = this.sessions.get(id);
    if (!s) throw new NotFoundException('Session Lia-Lab introuvable');
    return s;
  }

  private toView(session: LabSession): LabSessionView {
    const lastTenant = session.messages.filter((m) => m.role === 'tenant').at(-1)
      ?.text;
    return {
      sessionId: session.id,
      title: session.title,
      description: session.description,
      tenantFirstName: session.tenantFirstName,
      messages: session.messages,
      intake: session.state,
      visualization: buildLabVisualization({
        state: session.state,
        title: session.title,
        description: session.description,
        lastMessage: lastTenant,
      }),
    };
  }
}
