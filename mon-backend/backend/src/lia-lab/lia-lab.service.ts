/**
 * Lia-Lab — sandbox Grock (mono-agent).
 * Amnésie totale à chaque nouvelle session ; historique Marie = Supabase uniquement.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LiaHostService } from '../agents/orchestrateur/conversation/lia-host.service';
import { GROCK_MISTRAL_MODEL } from '../agents/orchestrateur/living-intelligence/living-intelligence.config';
import { GROCK_PERCEPTION_LOG_TITLE } from '../grock/grock-vision.prompt';
import {
  GrockService,
  type GrockChatMessage,
  type GrockTicketHistoryRow,
} from '../grock/grock.service';

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
  /** Dernière perception Pixtral (faits bruts). */
  visualPerception: string | null;
  visionModel: string | null;
  /** Dernier raisonnement interne Grock — visible seulement Lia-Lab. */
  thinking: string | null;
  /** Dernière note interne Grock — jamais visible locataire. */
  noteInterne: string | null;
  state: string | null;
  nextAction: string | null;
}

export interface GrockLabMessage {
  role: 'tenant' | 'grock';
  text: string;
  at: string;
  imagePreview?: string;
  noteInterne?: string;
}

export interface GrockPathologyAnswerView {
  answer: string;
  model: string;
  language: string;
}

interface GrockLabSession {
  id: string;
  title: string;
  description: string;
  tenantFirstName: string;
  language: string;
  ticketHistory: GrockTicketHistoryRow[];
  messages: GrockChatMessage[];
  lastModel: string | null;
  lastVisualPerception: string | null;
  visionModel: string | null;
  lastThinking: string | null;
  lastNoteInterne: string | null;
  lastState: string | null;
  lastNextAction: string | null;
}

function toLabMessages(messages: GrockChatMessage[]): GrockLabMessage[] {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'grock' : 'tenant',
    text: m.text,
    at: m.createdAt.toISOString(),
    imagePreview: m.imagePreview,
    noteInterne: m.note_interne,
  }));
}

@Injectable()
export class LiaLabService {
  private readonly logger = new Logger(LiaLabService.name);
  private readonly sessions = new Map<string, GrockLabSession>();

  constructor(
    private readonly grock: GrockService,
    private readonly host: LiaHostService,
    private readonly prisma: PrismaService,
  ) {}

  async startSession(params: {
    title: string;
    description: string;
    tenantFirstName?: string;
    language?: string;
  }): Promise<GrockLabSessionView> {
    const id = randomUUID();
    // Pas de prénom inventé : si non fourni, Grock reste générique.
    const tenantFirstName = params.tenantFirstName?.trim() ?? '';
    const language = params.language?.trim() || 'fr';
    const ticketHistory = await this.grock.loadTenantTicketHistory(tenantFirstName, 5);

    const session: GrockLabSession = {
      id,
      title: params.title.trim(),
      description: params.description.trim(),
      tenantFirstName,
      language,
      ticketHistory,
      messages: [],
      lastModel: null,
      lastVisualPerception: null,
      visionModel: null,
      lastThinking: null,
      lastNoteInterne: null,
      lastState: null,
      lastNextAction: null,
    };

    const opening = await this.grock.runTurn({
      tenantFirstName,
      title: session.title,
      description: session.description,
      language,
      ticketHistory,
      sessionMessages: [],
      tenantMessage: '',
      mode: 'opening',
    });

    session.lastModel = opening.model;
    session.lastThinking = opening.thinking ?? null;
    session.lastNoteInterne = opening.noteInterne ?? null;
    session.lastState = opening.state ?? null;
    session.lastNextAction = opening.nextAction ?? null;
    session.lastVisualPerception = opening.visualPerception ?? null;
    session.visionModel = opening.visionModel ?? null;
    session.messages.push({
      id: `grock-${Date.now()}`,
      role: 'assistant',
      text: opening.reply,
      thinking: opening.thinking ?? undefined,
      state: opening.state,
      next_action: opening.nextAction,
      acknowledgment: opening.acknowledgment,
      note_interne: opening.noteInterne ?? undefined,
      createdAt: new Date(),
    });

    this.sessions.set(id, session);
    return this.toView(session);
  }

  async sendTenantMessage(sessionId: string, text: string): Promise<GrockLabSessionView> {
    const session = this.getSession(sessionId);
    const trimmed = text.trim();
    if (!trimmed) return this.toView(session);

    session.messages.push({
      id: `tenant-${Date.now()}`,
      role: 'user',
      text: trimmed,
      createdAt: new Date(),
    });

    let turn;
    try {
      turn = await this.grock.runTurn({
        tenantFirstName: session.tenantFirstName,
        title: session.title,
        description: session.description,
        language: session.language,
        ticketHistory: session.ticketHistory,
        sessionMessages: session.messages,
        tenantMessage: trimmed,
        mode: 'tenant_turn',
      });
    } catch (e) {
      session.messages.pop();
      throw e;
    }

    session.lastModel = turn.model;
    session.lastThinking = turn.thinking ?? session.lastThinking;
    session.lastNoteInterne = turn.noteInterne ?? session.lastNoteInterne;
    session.lastState = turn.state ?? session.lastState;
    session.lastNextAction = turn.nextAction ?? session.lastNextAction;
    session.lastVisualPerception = turn.visualPerception ?? session.lastVisualPerception;
    session.visionModel = turn.visionModel ?? session.visionModel;
    session.messages.push({
      id: `grock-${Date.now()}`,
      role: 'assistant',
      text: turn.reply,
      thinking: turn.thinking ?? undefined,
      state: turn.state,
      next_action: turn.nextAction,
      acknowledgment: turn.acknowledgment,
      note_interne: turn.noteInterne ?? undefined,
      createdAt: new Date(),
    });

    return this.toView(session);
  }

  /** Photo locataire — perception Pixtral puis réponse Grock. */
  async sendTenantPhoto(
    sessionId: string,
    buffer: Buffer,
    mimeType: string,
    caption?: string,
  ): Promise<GrockLabSessionView> {
    const session = this.getSession(sessionId);
    if (!buffer.length) {
      throw new BadRequestException('Photo vide.');
    }
    const mime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
    const captionTrim = caption?.trim() ?? '';
    const tenantLine = captionTrim || '📷 Photo envoyée';

    session.messages.push({
      id: `tenant-${Date.now()}`,
      role: 'user',
      text: tenantLine,
      createdAt: new Date(),
      imagePreview: dataUrl,
    });

    let turn;
    try {
      turn = await this.grock.runTurn({
        tenantFirstName: session.tenantFirstName,
        title: session.title,
        description: session.description,
        language: session.language,
        ticketHistory: session.ticketHistory,
        sessionMessages: session.messages,
        tenantMessage: captionTrim || 'Photo envoyée par le locataire',
        mode: 'tenant_turn',
        images: [{ mimeType: mime, base64 }],
      });
    } catch (e) {
      session.messages.pop();
      throw e;
    }

    session.lastModel = turn.model;
    session.lastThinking = turn.thinking ?? session.lastThinking;
    session.lastNoteInterne = turn.noteInterne ?? session.lastNoteInterne;
    session.lastState = turn.state ?? session.lastState;
    session.lastNextAction = turn.nextAction ?? session.lastNextAction;
    if (turn.visualPerception) {
      session.lastVisualPerception = turn.visualPerception;
      session.visionModel = turn.visionModel ?? session.visionModel;
    }
    session.messages.push({
      id: `grock-${Date.now()}`,
      role: 'assistant',
      text: turn.reply,
      thinking: turn.thinking ?? undefined,
      state: turn.state,
      next_action: turn.nextAction,
      acknowledgment: turn.acknowledgment,
      note_interne: turn.noteInterne ?? undefined,
      createdAt: new Date(),
    });

    return this.toView(session);
  }

  /** Amnésie labo — destruction session mémoire (pas les tickets Supabase). */
  discardSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getVisualization(sessionId: string) {
    const session = this.getSession(sessionId);
    return {
      agent: 'Grock',
      model: session.lastModel ?? GROCK_MISTRAL_MODEL,
      visionModel: session.visionModel,
      ticketHistoryCount: session.ticketHistory.length,
      ticketHistory: session.ticketHistory,
      messageCount: session.messages.length,
      visualPerception: session.lastVisualPerception,
      thinking: session.lastThinking,
      noteInterne: session.lastNoteInterne,
      state: session.lastState,
      nextAction: session.lastNextAction,
      perceptionTitle: GROCK_PERCEPTION_LOG_TITLE,
      note: 'Architecture mono-agent — message + AFPOL + historique Marie (Supabase) + vision Pixtral.',
    };
  }

  async getGroqStatus() {
    const ping = await this.host.pingMistral();
    return {
      configured: this.host.isMistralConfigured(),
      ok: ping.ok,
      model: ping.model,
      provider: 'mistral',
      agent: 'Grock',
      error: ping.error ?? this.host.getLastGroqError(),
    };
  }

  async purgeAllLivingBuildingStates(): Promise<{
    ticketsPurged: number;
    sessionsCleared: number;
  }> {
    const result = await this.prisma.ticket.updateMany({
      data: {
        livingBuildingState: Prisma.JsonNull,
        buildingState: Prisma.JsonNull,
      },
    });
    const sessionsCleared = this.sessions.size;
    this.sessions.clear();
    return { ticketsPurged: result.count, sessionsCleared };
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
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const form = new FormData();
    form.append('file', blob, `grock-lab.${ext}`);
    form.append('model', process.env.GROQ_WHISPER_MODEL ?? 'whisper-large-v3-turbo');
    form.append('language', 'fr');
    form.append('response_format', 'json');

    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(`Transcription échouée (HTTP ${res.status}).`);
    }
    const data = (await res.json()) as { text?: string };
    const text = data.text?.trim();
    if (!text) throw new ServiceUnavailableException('Transcription vide.');
    return text;
  }

  async synthesizeSpeech(
    text: string,
    language = 'fr',
  ): Promise<{ audioBase64: string; mimeType: string }> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';
    if (!apiKey) {
      throw new ServiceUnavailableException('ELEVENLABS_API_KEY manquante.');
    }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(`Synthèse vocale échouée (HTTP ${res.status}).`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return {
      audioBase64: Buffer.from(arrayBuffer).toString('base64'),
      mimeType: 'audio/mpeg',
    };
  }

  /** Consultation pathologie — question directe, sans scénario. */
  async askPathology(
    question: string,
    language = 'fr',
  ): Promise<GrockPathologyAnswerView> {
    const result = await this.grock.answerPathologyQuestion(question);
    return {
      answer: result.answer,
      model: result.model,
      language,
    };
  }

  private getSession(id: string): GrockLabSession {
    const s = this.sessions.get(id);
    if (!s) throw new NotFoundException('Session Grock introuvable');
    return s;
  }

  private toView(session: GrockLabSession): GrockLabSessionView {
    return {
      sessionId: session.id,
      title: session.title,
      description: session.description,
      tenantFirstName: session.tenantFirstName,
      language: session.language,
      messages: toLabMessages(session.messages),
      ticketHistory: session.ticketHistory,
      model: session.lastModel,
      groqConfigured: this.host.isMistralConfigured(),
      visualPerception: session.lastVisualPerception,
      visionModel: session.visionModel,
      thinking: session.lastThinking,
      noteInterne: session.lastNoteInterne,
      state: session.lastState,
      nextAction: session.lastNextAction,
    };
  }
}
