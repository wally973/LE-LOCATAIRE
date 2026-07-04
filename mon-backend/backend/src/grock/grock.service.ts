/**

 * Grock — Mistral direct : signalement + docs AFPOL + fil locataire/Grock.

 */

import {
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { LLM_OPERATOR, type LlmOperatorPort } from './port/llm-operator.port';
import { DOMAIN_PACK, type GrockDomainPack } from './domain/domain-pack.port';
import { GrockDecisionJournalService } from './learning/grock-decision-journal.service';
import { GROCK_SYSTEM_PROMPT } from './grock.prompt';
import {
  GROCK_PERCEPTION_LOG_TITLE,
  GROCK_VISION_PERCEPTION_PROMPT,
} from './grock-vision.prompt';
import { GROCK_PATHOLOGY_ASSISTANT_PROMPT } from './grock-pathology.prompt';



export const GROCK_CONVERSATION_JARVIS_KEY = 'grock_conversation_fil';



export interface GrockTicketHistoryRow {

  caseNumber: string | null;

  title: string;

  description: string;

  status: string;

  createdAt: string;

  daysAgo: number;

}



export interface GrockChatMessage {

  id: string;

  role: 'system' | 'assistant' | 'user';

  text: string;

  thinking?: string;

  state?: string;

  next_action?: string;

  acknowledgment?: string;

  note_interne?: string;

  createdAt: Date;

  /** Aperçu data-URL pour le labo (photo locataire). */
  imagePreview?: string;

  /** Compatibilité temporaire anciens fils sérialisés. */
  at?: string;

  /** Compatibilité camelCase côté Lia-Lab. */
  noteInterne?: string;

}



export interface GrockImageAttachment {

  mimeType: string;

  base64: string;

}



export interface GrockTurnInput {

  tenantFirstName: string;

  title: string;

  description: string;

  language?: string;

  ticketHistory: GrockTicketHistoryRow[];

  sessionMessages: GrockChatMessage[];

  tenantMessage: string;

  mode: 'opening' | 'tenant_turn';

  /** Photos du tour courant (perception Pixtral puis dialogue). */
  images?: GrockImageAttachment[];

}



export interface GrockTurnResult {

  reply: string;

  thinking: string | null;

  acknowledgment: string;

  state: GrockConversationState;

  nextAction: string;

  /** Réflexion interne libre du modèle — non visible locataire. */
  noteInterne: string | null;

  fromLlm: boolean;

  model: string;

  /** Faits bruts Pixtral — affichés Lia-Lab sous [Perception Visuelle Brute]. */
  visualPerception?: string | null;

  visionModel?: string | null;

}

export type GrockConversationState =
  | 'ASK_ONE_QUESTION'
  | 'NEED_PHOTO'
  | 'READY_TICKET'
  | 'bailleur_responsable'
  | 'locataire_responsable'
  | 'sinistre'
  | 'SAFETY'
  | 'ACTION_LOCATAIRE'
  | 'WAITING_TENANT'
  | 'DOMAIN_SHIFT';



function grockMessageId(): string {
  return `grock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeGrockChatMessage(raw: unknown): GrockChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const text = typeof item.text === 'string' ? item.text : '';
  if (!text.trim()) return null;

  const rawRole = item.role;
  const role =
    rawRole === 'tenant' || rawRole === 'user'
      ? 'user'
      : rawRole === 'grock' || rawRole === 'assistant'
        ? 'assistant'
        : rawRole === 'system'
          ? 'system'
          : 'user';
  const rawCreatedAt =
    item.createdAt instanceof Date
      ? item.createdAt
      : typeof item.createdAt === 'string'
        ? new Date(item.createdAt)
        : typeof item.at === 'string'
          ? new Date(item.at)
          : new Date();
  const createdAt = Number.isNaN(rawCreatedAt.getTime()) ? new Date() : rawCreatedAt;

  return {
    id: typeof item.id === 'string' ? item.id : grockMessageId(),
    role,
    text,
    thinking: typeof item.thinking === 'string' ? item.thinking : undefined,
    state: typeof item.state === 'string' ? item.state : undefined,
    next_action: typeof item.next_action === 'string' ? item.next_action : undefined,
    acknowledgment:
      typeof item.acknowledgment === 'string' ? item.acknowledgment : undefined,
    note_interne:
      typeof item.note_interne === 'string'
        ? item.note_interne
        : typeof item.noteInterne === 'string'
          ? item.noteInterne
          : undefined,
    createdAt,
    imagePreview: typeof item.imagePreview === 'string' ? item.imagePreview : undefined,
  };
}

export function parseGrockConversationFil(raw: string | undefined): GrockChatMessage[] {

  if (!raw?.trim()) return [];

  try {

    const parsed = JSON.parse(raw) as unknown[];

    return Array.isArray(parsed)
      ? parsed
          .map((item) => normalizeGrockChatMessage(item))
          .filter((item): item is GrockChatMessage => item != null)
      : [];

  } catch {

    return [];

  }

}



export function readGrockConversationFil(

  facts: Record<string, string> | undefined,

): GrockChatMessage[] {

  return parseGrockConversationFil(facts?.[GROCK_CONVERSATION_JARVIS_KEY]);

}



export function writeGrockConversationFil(

  facts: Record<string, string> | undefined,

  fil: GrockChatMessage[],

): Record<string, string> {

  return {

    ...(facts ?? {}),

    [GROCK_CONVERSATION_JARVIS_KEY]: JSON.stringify(fil),

  };

}



function buildConversationSteerHint(
  mode: 'opening' | 'tenant_turn',
  sessionMessages: GrockChatMessage[],
  tenantMessage: string,
): string | null {
  if (mode !== 'tenant_turn') return null;
  const msg = tenantMessage.trim();
  if (!msg) return null;

  const shortAck =
    /^(d'?accord|ok|oui|c'?est fait|coup[eé])\s*\.?$/iu.test(msg) ||
    (msg.length <= 24 && /^(oui|ok|d'?accord)/iu.test(msg));

  const lastAssistant = [...sessionMessages]
    .reverse()
    .find((m) => m.role === 'assistant');
  const lastState = lastAssistant?.state ?? '';
  const safetyTurn = ['SAFETY', 'ACTION_LOCATAIRE', 'WAITING_TENANT'].includes(
    lastState,
  );

  if (shortAck && safetyTurn) {
    return [
      '--- Consigne tour suivant ---',
      'Le locataire a acquiescé aux consignes de sécurité : ne répète pas couper l’électricité ni les mêmes phrases.',
      'Enchaîne avec state sinistre si dégât des eaux actif au plafond / luminaires,',
      'ou NEED_PHOTO, ou UNE question (depuis quand, étage, voisin au-dessus, courant coupé oui/non).',
    ].join('\n');
  }

  if (!shortAck && safetyTurn) {
    return [
      '--- Consigne tour suivant ---',
      'Le locataire apporte un complément : intègre-le, ne répète pas le bloc sécurité déjà donné.',
      'Avance vers sinistre, NEED_PHOTO ou READY_TICKET selon les faits.',
    ].join('\n');
  }

  return null;
}

function toChatTurns(messages: GrockChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {

  return messages.map((m) => ({

    role: m.role === 'user' ? ('user' as const) : ('assistant' as const),

    content:
      m.role === 'assistant' && (m.note_interne?.trim() || m.noteInterne?.trim())
        ? [
            m.text.trim(),
            '',
            '[note_interne précédente — non visible du locataire]',
            (m.note_interne ?? m.noteInterne ?? '').trim(),
          ].join('\n')
        : m.text.trim(),

  }));

}






interface GrockStructuredReply {
  thinking: string;
  state: GrockConversationState;
  next_action: string;
  acknowledgment: string;
  note_interne: string;
}

export interface GrockReply {
  thinking: string;
  state: string;
  next_action: string;
  acknowledgment: string;
  note_interne: string;
}

function parseGrockJsonSafe(
  raw: string,
  logError?: (message: string, error: unknown) => void,
): GrockReply | null {
  try {
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    // Extraction ciblée des 5 champs sans toucher au JSON global
    const extract = (key: string) => {
      const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 's');
      const match = raw.match(regex);
      return match ? match[1].replace(/\n/g, ' ') : '';
    };

    return {
      thinking: extract('thinking'),
      state: extract('state'),
      next_action: extract('next_action'),
      acknowledgment: extract('acknowledgment'),
      note_interne: extract('note_interne'),
    };
  } catch (e) {
    if (logError) {
      logError('parseGrockJson failed (safe mode)', e);
    } else {
      console.error('parseGrockJson failed (safe mode)', e);
    }
    return null;
  }
}

export function parseGrockJson(raw: string): GrockReply | null {
  return parseGrockJsonSafe(raw);
}

const GROCK_STATES: readonly GrockConversationState[] = [
  'ASK_ONE_QUESTION',
  'NEED_PHOTO',
  'READY_TICKET',
  'bailleur_responsable',
  'locataire_responsable',
  'sinistre',
  'SAFETY',
  'ACTION_LOCATAIRE',
  'WAITING_TENANT',
  'DOMAIN_SHIFT',
] as const;

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function unescapeLooseJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw.replace(/\r?\n/g, '\\n')}"`) as string;
  } catch {
    return raw
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .trim();
  }
}

function extractLooseStringField(raw: string, field: string): string | null {
  const key = `"${field}"`;
  const keyIndex = raw.indexOf(key);
  if (keyIndex < 0) return null;

  const colonIndex = raw.indexOf(':', keyIndex + key.length);
  if (colonIndex < 0) return null;

  const quoteIndex = raw.indexOf('"', colonIndex + 1);
  if (quoteIndex < 0) return null;

  let escaped = false;
  let value = '';
  for (let i = quoteIndex + 1; i < raw.length; i += 1) {
    const char = raw[i];
    if (escaped) {
      value += `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      return unescapeLooseJsonString(value);
    }
    value += char;
  }

  return value.trim() || null;
}

function containsConcreteSafetySignal(text: string): boolean {
  const t = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return (
    /secours|pompier|samu|police|gendarmerie|urgence vitale/.test(t) ||
    /(danger|urgent|urgence).{0,80}(electri|gaz|brul|fumee|etincell|arc|prise|disjoncteur|effondr|structure|bloqu|enferm|enfant|ascenseur)/.test(
      t,
    ) ||
    /(electri|gaz|brul|fumee|etincell|arc|prise|disjoncteur|effondr|structure|bloqu|enferm|enfant|ascenseur).{0,80}(danger|urgent|urgence)/.test(
      t,
    )
  );
}

function normalizeGrockState(raw: unknown, acknowledgment: string): GrockConversationState {
  if (typeof raw === 'string' && GROCK_STATES.includes(raw as GrockConversationState)) {
    if (raw === 'SAFETY' && !containsConcreteSafetySignal(acknowledgment)) {
      return acknowledgment.includes('?') ? 'ASK_ONE_QUESTION' : 'WAITING_TENANT';
    }
    return raw as GrockConversationState;
  }

  const text = acknowledgment.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (containsConcreteSafetySignal(acknowledgment)) return 'SAFETY';
  if (/ticket|technicien/.test(text)) return 'READY_TICKET';
  if (/photo|image/.test(text)) return 'NEED_PHOTO';
  if (acknowledgment.includes('?')) return 'ASK_ONE_QUESTION';
  if (/fermez|coupez|n'utilisez|n utilisez|appelez|protegez/.test(text)) {
    return 'ACTION_LOCATAIRE';
  }
  return 'WAITING_TENANT';
}

function hasActionableEnding(text: string): boolean {
  const normalized = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return (
    text.includes('?') ||
    /ticket|technicien|appelez|envoyez|envoyer|fermez|coupez|n'utilisez|n utilisez|dites-moi|dites moi|oui\/non|oui ou non|photo|securite|secours/.test(
      normalized,
    )
  );
}

function firstQuestionOnly(text: string): string {
  const first = text.indexOf('?');
  if (first < 0) return text;
  return text.slice(0, first + 1).trim();
}

/**
 * Garde-fou INV2 : un vrai message au locataire est une PHRASE, pas un mot nu.
 * Certains tours Mistral renvoient un `acknowledgment` réduit à un jeton
 * (« sécurité », « urgence », « photo »…) : ce n'est jamais une parole affichable.
 * On considère l'accusé de réception comme dégénéré s'il ne contient pas de
 * question et fait moins de trois mots.
 */
function isDegenerateAcknowledgment(ack: string): boolean {
  const t = ack.trim();
  if (!t) return true;
  if (t.includes('?')) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length < 3;
}

/**
 * Filet anti-fuite (confidentialité) : retire de la parole visible les
 * identifiants internes que le modèle aurait pu recopier depuis une capture
 * d'écran (codes de suivi type « QV0373 », références alphanumériques).
 * C'est un garde de confidentialité, PAS un moteur de raisonnement : il ne
 * réécrit pas le sens, il masque seulement des jetons techniques porteurs de
 * chiffres. Les acronymes pures (sans chiffre) sont gérés par le prompt.
 */
export function stripInternalJargon(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b[A-Z]{2,}\d[A-Z0-9]*\b/g, '')
    .replace(/\b[A-Z]\d{2,}[A-Z0-9]*\b/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    // Uniquement « . » et « , » : le français garde l'espace avant ? ! : ;
    .replace(/\s+([.,])/g, '$1')
    .trim();
}

/** Phrase de repli garantie non dégénérée quand aucun état spécifique ne convient. */
const SAFE_GENERIC_ACK =
  'Dites-moi ce que vous voyez maintenant : où se situe le problème et depuis quand ?';

function fallbackAcknowledgment(
  state: GrockConversationState,
  nextAction: string,
): string {
  if (state === 'READY_TICKET') {
    return "OK, j’ai assez d’éléments. J’envoie un ticket au technicien du secteur, il vous contactera.";
  }
  if (state === 'SAFETY') {
    return "Si quelqu’un est bloqué ou en danger, appelez les secours maintenant. J’envoie aussi un ticket au technicien du secteur.";
  }
  if (state === 'NEED_PHOTO') {
    return 'Pouvez-vous envoyer une photo de la zone concernée ?';
  }
  if (state === 'bailleur_responsable') {
    return "C’est à la charge du bailleur : je transmets un ticket au technicien du secteur, il vous contactera.";
  }
  if (state === 'locataire_responsable') {
    return "D’après ce que je vois, cet entretien est à votre charge. Dites-moi si vous voulez que je vous explique la marche à suivre.";
  }
  if (state === 'sinistre') {
    return "Cela ressemble à un sinistre : ne touchez à rien, prenez une photo si c’est sans danger, et je fais remonter le dossier au bailleur.";
  }
  const trimmed = nextAction.trim();
  // Un état ouvert (question / action) : on réutilise next_action SEULEMENT s'il
  // constitue une vraie phrase — jamais un mot nu (« technicien »), sinon on
  // retomberait dans une réponse dégénérée.
  const usableNextAction = trimmed && !isDegenerateAcknowledgment(trimmed) ? trimmed : '';
  if (state === 'ASK_ONE_QUESTION') {
    return usableNextAction.endsWith('?')
      ? usableNextAction
      : 'Pouvez-vous me confirmer en un mot : oui ou non ?';
  }
  if (state === 'ACTION_LOCATAIRE') {
    return (
      usableNextAction ||
      'Faites l’action la plus sûre maintenant, puis dites-moi si le problème continue.'
    );
  }
  return usableNextAction || SAFE_GENERIC_ACK;
}

function validateAcknowledgment(params: {
  acknowledgment: string;
  state: GrockConversationState;
  nextAction: string;
}): string {
  const ack = params.acknowledgment.trim();

  // Vide OU mot nu (« sécurité », « urgence »…) : jamais affichable au locataire.
  if (!ack || isDegenerateAcknowledgment(ack)) {
    const fallback = fallbackAcknowledgment(params.state, params.nextAction);
    // Ceinture + bretelles : même le repli ne doit jamais être dégénéré.
    return isDegenerateAcknowledgment(fallback) ? SAFE_GENERIC_ACK : fallback;
  }

  return ack;
}

/**
 * Reconstruit la sortie JSON de l'opérateur de langage (PORT IA).
 * Le raisonnement (5 têtes) est porté par le prompt maître : aucun moteur de
 * règles externe ne réécrit l'état ni la parole après coup.
 */
export function parseGrockStructuredReply(raw: string): GrockStructuredReply {
  return parseGrockStructuredReplyRaw(raw);
}

function parseGrockStructuredReplyRaw(raw: string): GrockStructuredReply {
  const parsed = parseGrockJson(extractJsonObject(raw));
  if (parsed?.acknowledgment.trim()) {
    const acknowledgment = parsed.acknowledgment.trim();
    const state = normalizeGrockState(parsed.state, acknowledgment);
    const nextAction = parsed.next_action.trim();
    return {
      thinking: parsed.thinking.trim(),
      state,
      next_action: nextAction,
      note_interne: parsed.note_interne.trim(),
      acknowledgment: validateAcknowledgment({
        acknowledgment,
        state,
        nextAction,
      }),
    };
  }

  const looseAcknowledgment = extractLooseStringField(raw, 'acknowledgment');
  if (looseAcknowledgment?.trim()) {
    const looseNextAction = extractLooseStringField(raw, 'next_action') ?? '';
    const looseNoteInterne = extractLooseStringField(raw, 'note_interne') ?? '';
    const looseState = normalizeGrockState(
      extractLooseStringField(raw, 'state'),
      looseAcknowledgment,
    );
    return {
      thinking:
        extractLooseStringField(raw, 'thinking') ??
        'Réponse Mistral mal formée : acknowledgment extrait et brut non affiché au locataire.',
      state: looseState,
      next_action: looseNextAction.trim(),
      note_interne: looseNoteInterne.trim(),
      acknowledgment: validateAcknowledgment({
        acknowledgment: looseAcknowledgment,
        state: looseState,
        nextAction: looseNextAction,
      }),
    };
  }

  const fallbackState: GrockConversationState = 'WAITING_TENANT';
  const fallbackThinking =
    extractLooseStringField(raw, 'thinking') ??
    `Réponse Mistral non conforme au JSON thinking/acknowledgment. Contenu brut bloqué côté locataire :\n${raw.trim()}`;
  const fallbackNoteInterne =
    extractLooseStringField(raw, 'note_interne') ??
    'Sortie brute conservée dans thinking ; aucune note_interne structurée fournie.';
  return {
    thinking: fallbackThinking,
    state: fallbackState,
    next_action: '',
    note_interne: fallbackNoteInterne,
    acknowledgment:
      'Je reprends votre message : pouvez-vous préciser l’endroit exact du problème et ce que vous voyez ?',
  };
}



@Injectable()

export class GrockService {

  private readonly logger = new Logger(GrockService.name);



  /** Journal de décision (étage 1 de la boucle d'apprentissage) — écriture seule. */
  private readonly decisionJournal: GrockDecisionJournalService;

  constructor(

    @Inject(LLM_OPERATOR)
    private readonly operator: LlmOperatorPort,

    @Inject(DOMAIN_PACK)
    private readonly domainPack: GrockDomainPack,

    private readonly prisma: PrismaService,

    // Optionnel : injecté en production, sinon reconstruit depuis `prisma` pour
    // ne pas casser les instanciations manuelles (tests, harness).
    @Optional()
    journal?: GrockDecisionJournalService,

  ) {
    this.decisionJournal = journal ?? new GrockDecisionJournalService(prisma);
  }

  private parseGrockJson(raw: string): GrockReply | null {
    return parseGrockJsonSafe(raw, (message, error) =>
      this.logger.error(message, error),
    );
  }

  private async saveMessage(params: {
    role: 'assistant' | 'user' | 'system';
    text: string;
    thinking?: string | null;
    state?: string | null;
    next_action?: string | null;
    acknowledgment?: string | null;
    note_interne?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "grock_messages" (
          "role",
          "text",
          "thinking",
          "state",
          "next_action",
          "acknowledgment",
          "note_interne"
        )
        VALUES (
          ${params.role},
          ${params.text},
          ${params.thinking ?? null},
          ${params.state ?? null},
          ${params.next_action ?? null},
          ${params.acknowledgment ?? null},
          ${params.note_interne ?? null}
        )
      `;
    } catch (e) {
      this.logger.warn('[Grock] Sauvegarde GrockMessage impossible', e);
    }
  }



  async loadTenantTicketHistory(

    tenantFirstName: string,

    limit = 5,

  ): Promise<GrockTicketHistoryRow[]> {

    const name = tenantFirstName.trim();

    if (!name) return [];



    const profile = await this.prisma.tenantProfile.findFirst({

      where: { firstName: { equals: name, mode: 'insensitive' } },

      select: { id: true },

    });

    if (!profile) return [];



    const tickets = await this.prisma.ticket.findMany({

      where: { tenantId: profile.id },

      orderBy: { createdAt: 'desc' },

      take: limit,

      select: {

        caseNumber: true,

        title: true,

        description: true,

        status: true,

        createdAt: true,

      },

    });



    const now = Date.now();

    return tickets.map((t) => ({

      caseNumber: t.caseNumber,

      title: t.title,

      description: t.description.slice(0, 400),

      status: t.status,

      createdAt: t.createdAt.toISOString(),

      daysAgo: Math.max(0, Math.floor((now - t.createdAt.getTime()) / 86_400_000)),

    }));

  }



  /** Consultation pathologie — sans fil Intercom, réponse experte. */
  async answerPathologyQuestion(question: string): Promise<{ answer: string; model: string }> {
    const q = question.trim();
    if (!q) {
      return {
        answer: 'Pose une question de pathologie (ex: humidité, infiltration, fissure).',
        model: 'grock',
      };
    }

    const systemPrompt = [
      GROCK_PATHOLOGY_ASSISTANT_PROMPT,
      '',
      this.domainPack.pathologyKnowledge(),
    ].join('\n');

    const result = await this.operator.reason({
      systemPrompt,
      turns: [{ role: 'user', content: q }],
      maxTokens: 700,
      timeoutMs: 60_000,
    });

    if (!result?.text?.trim()) {
      throw new ServiceUnavailableException(this.operator.describeFailure());
    }

    return { answer: result.text.trim(), model: result.model };
  }

  /** Perception visuelle brute — Pixtral, sans diagnostic. */
  async runVisualPerception(input: {
    title: string;
    description: string;
    tenantMessage?: string;
    image: GrockImageAttachment;
  }): Promise<{ perception: string; model: string } | null> {
    // Perception AVEUGLE AU CADRAGE : on ne transmet PAS le titre/description/
    // message du locataire au modèle de vision. Sinon un récit orienté (« fuite
    // d'eau », « problème électrique ») teinte la lecture des pixels et la même
    // photo est décrite différemment selon la suggestion. La perception doit être
    // invariante ; c'est la tête de raisonnement (qui voit l'image ET le récit)
    // qui confronte ensuite les deux.
    const result = await this.operator.see({
      systemPrompt: GROCK_VISION_PERCEPTION_PROMPT,
      userText:
        'Décris uniquement ce qui est objectivement visible sur la photo. ' +
        'Ne tiens compte d’aucun titre, récit ou hypothèse : décris les faits ' +
        'visuels (objets, matériaux, désordres, mesures apparentes), sans orientation.',
      image: input.image,
      maxTokens: 500,
      timeoutMs: 90_000,
    });

    if (!result?.text?.trim()) {
      this.logger.warn('[Grock] Perception visuelle vide ou indisponible');
      return null;
    }

    return { perception: result.text.trim(), model: result.model };
  }

  private async repairStructuredReply(raw: string): Promise<GrockStructuredReply | null> {
    const repairPrompt = [
      'Tu répares une sortie Grock mal formée.',
      'Ne change pas le fond du raisonnement. Ne rajoute pas de diagnostic.',
      'Retourne uniquement un JSON strict valide avec ce schéma :',
      '{"thinking":"...","state":"ASK_ONE_QUESTION|NEED_PHOTO|READY_TICKET|bailleur_responsable|locataire_responsable|sinistre|SAFETY|ACTION_LOCATAIRE|WAITING_TENANT|DOMAIN_SHIFT","next_action":"...","acknowledgment":"...","note_interne":"..."}',
      'acknowledgment doit être la parole visible pour le locataire, courte et naturelle.',
      'note_interne doit conserver toute réflexion interne utile non affichable au locataire.',
    ].join('\n');

    try {
      const repaired = await this.operator.reason({
        systemPrompt: repairPrompt,
        turns: [
          {
            role: 'user',
            content: `Sortie à réparer, sans l'afficher telle quelle au locataire :\n${raw}`,
          },
        ],
        maxTokens: 1200,
        timeoutMs: 30_000,
        json: true,
      });

      if (!repaired?.text?.trim()) return null;
      const structured = parseGrockStructuredReply(repaired.text);
      if (structured.thinking.startsWith('Réponse Mistral non conforme')) {
        return null;
      }
      return structured;
    } catch (e) {
      this.logger.warn('[Grock] Réparation JSON impossible', e);
      return null;
    }
  }



  async runTurn(input: GrockTurnInput): Promise<GrockTurnResult> {

    if (!this.operator.isConfigured()) {

      throw new ServiceUnavailableException(this.operator.describeFailure());

    }



    // Aucun prénom inventé : si le locataire ne l'a pas donné, on ne fabrique
    // pas d'identité. Grock est instruit de rester générique (« Bonjour »).
    const name = input.tenantFirstName.trim();

    let visualPerception: string | null = null;

    let visionModel: string | null = null;

    const image = input.images?.[input.images.length - 1];

    if (image) {

      const perc = await this.runVisualPerception({

        title: input.title,

        description: input.description,

        tenantMessage: input.tenantMessage || undefined,

        image,

      });

      if (perc) {

        visualPerception = perc.perception;

        visionModel = perc.model;

      }

    }

    // Savoir métier fourni par le PACK (Couche 3) : le noyau ne connaît ni les
    // pathologies, ni le logement social, ni la doctrine — il les reçoit ici.
    const knowledge = this.domainPack.intercomKnowledge({
      title: input.title,
      description: input.description,
      tenantMessage: input.tenantMessage,
      sessionMessages: input.sessionMessages,
      visualPerception,
    });

    const steerHint = buildConversationSteerHint(
      input.mode,
      input.sessionMessages,
      input.tenantMessage,
    );

    const systemPrompt = [

      GROCK_SYSTEM_PROMPT,

      ...knowledge.head.flatMap((block) => ['', block]),

      '',

      '--- Signalement ---',

      name
        ? `Locataire : ${name}`
        : 'Locataire : prénom non communiqué — ne fabrique aucun prénom, dis simplement « Bonjour ».',

      `Titre : ${input.title}`,

      `Description : ${input.description}`,

      ...(visualPerception

        ? ['', GROCK_PERCEPTION_LOG_TITLE, visualPerception]

        : []),

      ...(steerHint ? ['', steerHint] : []),

      '',

      ...knowledge.tail,

    ].join('\n');



    const turns = toChatTurns(input.sessionMessages);

    if (!turns.length) {

      const opening = [input.title, input.description].filter(Boolean).join('\n').trim();

      turns.push({ role: 'user', content: opening || 'Signalement locataire' });

    }



    // Vue directe : on transmet l'image au raisonnement (modèle multimodal),
    // en plus de la perception neutre. Le modèle croise ainsi sa propre lecture
    // des pixels avec la perception brute → fin de l'hallucination « fissure ».
    const result = await this.operator.reason({
      systemPrompt,
      turns,
      maxTokens: 1200,
      timeoutMs: 60_000,
      json: true,
      images: input.images?.length ? input.images : undefined,
    });



    if (!result?.text?.trim()) {

      this.logger.warn('[Grock] Opérateur IA indisponible ou réponse vide');

      throw new ServiceUnavailableException(this.operator.describeFailure());

    }



    let structured = parseGrockStructuredReply(result.text);
    // Accusé de réception brut dégénéré (mot nu type « sécurité ») : on laisse
    // d'abord Grock reformuler un vrai message via la réparation (priorité IA).
    const rawAcknowledgment =
      extractLooseStringField(result.text, 'acknowledgment') ?? '';
    if (
      structured.thinking.startsWith('Réponse Mistral non conforme') ||
      !structured.next_action.trim() ||
      !structured.note_interne.trim() ||
      structured.note_interne.startsWith('Sortie brute conservée') ||
      isDegenerateAcknowledgment(rawAcknowledgment)
    ) {
      structured = (await this.repairStructuredReply(result.text)) ?? structured;
    }
    // Confidentialité : on masque tout identifiant interne dans la parole visible,
    // puis on re-valide (le masquage ne doit pas produire un message dégénéré).
    structured.acknowledgment = validateAcknowledgment({
      acknowledgment: stripInternalJargon(structured.acknowledgment),
      state: structured.state,
      nextAction: structured.next_action,
    });
    if (structured.note_interne.trim()) {
      // eslint-disable-next-line no-console
      console.log('[GROCK note_interne]', structured.note_interne.trim());
      this.logger.debug(`[Grock note_interne] ${structured.note_interne.trim()}`);
    }
    await this.saveMessage({
      role: 'assistant',
      text: structured.acknowledgment ?? '',
      thinking: structured.thinking ?? null,
      state: structured.state ?? null,
      next_action: structured.next_action ?? null,
      acknowledgment: structured.acknowledgment ?? null,
      note_interne: structured.note_interne ?? null,
    });

    // Journal de décision (hors session) : matière brute des sondes de qualité.
    // La clé photoHash corrèle les tours portant la même image (sonde variance).
    await this.decisionJournal.record({
      photoHash: GrockDecisionJournalService.hashImage(image?.base64),
      title: input.title || null,
      description: input.description || null,
      tenantMessage: input.tenantMessage || null,
      perception: visualPerception,
      state: structured.state ?? null,
      acknowledgment: structured.acknowledgment ?? null,
      noteInterne: structured.note_interne || null,
      model: result.model ?? null,
      visionModel,
    });

    return {

      reply: structured.acknowledgment,

      thinking: structured.thinking,

      acknowledgment: structured.acknowledgment,

      state: structured.state,

      nextAction: structured.next_action,

      noteInterne: structured.note_interne || null,

      fromLlm: true,

      model: result.model,

      visualPerception,

      visionModel,

    };

  }

}

