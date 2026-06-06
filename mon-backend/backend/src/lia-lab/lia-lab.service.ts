import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LiaJarvisPilotService } from '../agents/orchestrateur/intake/lia-jarvis-pilot.service';
import type { LiaIntakeState } from '../agents/orchestrateur/intake/lia-intake.service';
import { buildLabTenantSocialContext } from '../agents/shared/lia-tenant-social-context';
import { buildLabVisualization, type LiaLabVisualization } from './lia-lab-visualization';
import { isLivingIntelligenceEnabled } from '../agents/orchestrateur/living-intelligence/living-intelligence.config';
import { readLivingStateFromIntake } from '../agents/orchestrateur/living-intelligence/living-building-state.repository';
import { buildArchitectDoctrinePrompt } from '../agents/orchestrateur/living-intelligence/living-doctrine-stylo';

export interface LabChatMessage {
  role: 'tenant' | 'lia' | 'architect';
  text: string;
  at: string;
  uiStatusLabel?: string;
  doctrineLessonId?: string;
}

export interface LabSessionView {
  sessionId: string;
  title: string;
  description: string;
  tenantFirstName: string;
  messages: LabChatMessage[];
  visualization: LiaLabVisualization;
  intake: LiaIntakeState;
  bridgeStatus: {
    livingIntelligenceEnabled: boolean;
    reasoningSource: string | null;
  };
}

interface LabSession {
  id: string;
  title: string;
  description: string;
  tenantFirstName: string;
  residenceUnitNumber?: string;
  tenantAgeBand?: string;
  interlocutorRole?: string;
  lastClosedTicketSummary?: string;
  lastClosedTicketTitle?: string;
  state: LiaIntakeState;
  messages: LabChatMessage[];
  /** Leçons doctrine déjà proposées à l'Architecte (évite répétition). */
  announcedDoctrineIds: Set<string>;
}

@Injectable()
export class LiaLabService {
  private readonly logger = new Logger(LiaLabService.name);
  private readonly sessions = new Map<string, LabSession>();

  constructor(private readonly jarvis: LiaJarvisPilotService) {}

  /** Presets Lia-Lab — cas métier courants. */
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
    return [
      {
        id: 'electrical_outlet_crackle',
        label: 'Prise qui grésille (arc électrique)',
        title: 'Prise électrique dangereuse',
        description:
          'Une prise du salon est arrachée du mur, les fils sont visibles et ça grésille quand je m’approche.',
        housingUnit: 'R+2 — Apt 204',
        legalThemeId: 'electricite_securite',
        perimetre: 'Charge bailleur — urgence sécurité',
        tenantTurnHint: "J'ai coupé le disjoncteur",
      },
      {
        id: 'humidity_mould_envelope',
        label: 'Moisissures (enveloppe / étanchéité)',
        title: 'Moisissures au plafond',
        description:
          'Taches noires et moisissures au plafond du salon, près de la fenêtre. Ça s’aggrave quand il pleut.',
        housingUnit: 'R+4 — Apt 402',
        legalThemeId: 'humidite_enveloppe',
        perimetre: 'Enveloppe — charge bailleur probable',
        tenantTurnHint: 'Oui ça apparaît surtout quand il pleut',
      },
      {
        id: 'flooring_tiles_lifted',
        label: 'Carrelage qui se soulève (chambre)',
        title: 'Carrelage',
        description:
          'Les carreaux de la chambre de mon fils se sont levés d’un coup. Un carreau est cassé, rien d’autre d’anormal.',
        housingUnit: 'R+3 — Apt 12',
        legalThemeId: 'sols_carrelage',
        perimetre: 'Sols durs — patrimoine / vétusté probable',
        tenantTurnHint: 'Non rien, simplement que c’est levé et il y en a un cassé',
      },
      {
        id: 'plumbing_sink',
        label: 'Fuite sous évier',
        title: 'Fuite d’eau',
        description: 'Il y a une fuite sous l’évier de la cuisine depuis ce matin.',
        housingUnit: 'R+1 — Apt 12',
        legalThemeId: 'plomberie',
        perimetre: 'Amont / aval',
        tenantTurnHint: null,
      },
    ];
  }

  createSession(params: {
    title: string;
    description: string;
    tenantFirstName?: string;
    language?: string;
    residenceUnitNumber?: string;
    tenantAgeBand?: string;
    interlocutorRole?: string;
    lastClosedTicketSummary?: string;
    lastClosedTicketTitle?: string;
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
      tenantAgeBand: params.tenantAgeBand,
      interlocutorRole: params.interlocutorRole,
      lastClosedTicketSummary: params.lastClosedTicketSummary?.trim(),
      lastClosedTicketTitle: params.lastClosedTicketTitle?.trim(),
      state: {
        ...state,
        jarvisFacts: {
          ...(state.jarvisFacts ?? {}),
          ...(params.tenantAgeBand ? { tenant_age_band: params.tenantAgeBand } : {}),
          ...(params.interlocutorRole
            ? { tenant_interlocutor_role: params.interlocutorRole }
            : {}),
          ...(params.lastClosedTicketSummary
            ? { tenant_last_closed_summary: params.lastClosedTicketSummary.trim() }
            : {}),
          ...(params.lastClosedTicketTitle
            ? { tenant_last_closed_title: params.lastClosedTicketTitle.trim() }
            : {}),
        },
      },
      messages: [],
      announcedDoctrineIds: new Set(),
    };
    this.sessions.set(id, session);
    return this.toView(session);
  }

  async startSession(params: {
    title: string;
    description: string;
    tenantFirstName?: string;
    language?: string;
    residenceUnitNumber?: string;
    tenantAgeBand?: string;
    interlocutorRole?: string;
    lastClosedTicketSummary?: string;
    lastClosedTicketTitle?: string;
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
      tenantSocial: buildLabTenantSocialContext({
        tenantFirstName: session.tenantFirstName,
        ageBand: session.tenantAgeBand as 'senior' | 'adult' | 'young' | 'unknown' | undefined,
        interlocutorRole: session.interlocutorRole as 'tenant' | 'staff_tester' | undefined,
        lastClosedTicketSummary: session.lastClosedTicketSummary,
        lastClosedTicketTitle: session.lastClosedTicketTitle,
        currentTitle: session.title,
      }),
    });
    session.state = turn.state;
    session.messages.push({
      role: 'lia',
      text: turn.acknowledgment,
      at: new Date().toISOString(),
      uiStatusLabel: turn.uiStatus?.label,
    });
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
      tenantSocial: buildLabTenantSocialContext({
        tenantFirstName: session.tenantFirstName,
        ageBand: session.tenantAgeBand as 'senior' | 'adult' | 'young' | 'unknown' | undefined,
        interlocutorRole: session.interlocutorRole as 'tenant' | 'staff_tester' | undefined,
        lastClosedTicketSummary: session.lastClosedTicketSummary,
        lastClosedTicketTitle: session.lastClosedTicketTitle,
        currentTitle: session.title,
      }),
    });
    session.state = turn.state;
    session.messages.push({
      role: 'lia',
      text: turn.acknowledgment,
      at: new Date().toISOString(),
      uiStatusLabel: turn.uiStatus?.label,
    });
    this.appendArchitectDoctrinePrompts(session);

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

  discardSession(sessionId: string): void {
    this.sessions.delete(sessionId);
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

  /** Aperçu délibération — modèles Groq des 3 agents. */
  getDeliberationPreview(sessionId: string) {
    const session = this.getSession(sessionId);
    const living = readLivingStateFromIntake(session.state.jarvisFacts);
    return {
      sessionId: session.id,
      generatedAt: new Date().toISOString(),
      livingIntelligenceEnabled: isLivingIntelligenceEnabled(),
      models: {
        majordome: process.env.GROQ_MAJORDOME_MODEL ?? 'llama-3.3-70b-versatile',
        enqueteur: process.env.GROQ_ENQUETEUR_MODEL ?? 'llama-3.1-8b-instant',
        archiviste: process.env.GROQ_ARCHIVISTE_MODEL ?? 'llama-3.1-8b-instant',
      },
      livingState: living,
      deliberationEchoes: living?.deliberationEchoes ?? [],
    };
  }

  private getSession(id: string): LabSession {
    const s = this.sessions.get(id);
    if (!s) throw new NotFoundException('Session Lia-Lab introuvable');
    return s;
  }

  /** Propose au Registre de Sagesse après délibération Gardien PASS. */
  private appendArchitectDoctrinePrompts(session: LabSession): void {
    const living = readLivingStateFromIntake(session.state.jarvisFacts);
    if (!living?.guardianReview) return;
    if (living.guardianReview.verdict !== 'PASS') return;

    const pending =
      living.guardianReview.pendingDoctrineLessons ??
      living.doctrinePending ??
      [];
    if (!pending.length) return;

    for (const lesson of pending) {
      if (session.announcedDoctrineIds.has(lesson.id)) continue;
      session.announcedDoctrineIds.add(lesson.id);
      session.messages.push({
        role: 'architect',
        text: buildArchitectDoctrinePrompt(lesson.title),
        at: new Date().toISOString(),
        doctrineLessonId: lesson.id,
      });
    }
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
      bridgeStatus: {
        livingIntelligenceEnabled: isLivingIntelligenceEnabled(),
        reasoningSource:
          session.state.jarvisFacts?.reasoning_source ??
          (readLivingStateFromIntake(session.state.jarvisFacts)
            ? 'living_intelligence'
            : null),
      },
    };
  }
}
