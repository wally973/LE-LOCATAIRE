import { Injectable, Logger } from '@nestjs/common';
import { NonRecevableReason, TicketResponsibility } from '@prisma/client';
import type { AiMemoryChunk } from '../ai-memory.service';
import { AiMemoryService } from '../ai-memory.service';
import type { AiPipelineDecision, AiPipelineInput } from '../ai-pipeline.port';
import { parseJsonFromLlm } from '../utils/llm-json.util';
import type { PathologistResult } from './pathologist.types';

interface MistralJuristJson {
  responsibility:
    | 'BAILLEUR'
    | 'LOCATAIRE'
    | 'SOCIAL'
    | 'NON_RECEVABLE'
    | 'ESCALADE_BAILLEUR'
    | 'PENDING';
  nonRecevableReason?:
    | 'JURIDIQUE_VOISIN'
    | 'ASSURANCE_DEGATS_EAUX'
    | null;
  message: string;
  socialFlag: boolean;
  rationale: string;
}

/**
 * Agent juriste — responsabilité bailleur/locataire/social à partir du diagnostic
 * pathologiste et de la mémoire AiMemory (Mistral ou règles de simulation).
 */
@Injectable()
export class LiaJuristService {
  private readonly logger = new Logger(LiaJuristService.name);

  constructor(private readonly aiMemory: AiMemoryService) {}

  async decide(params: {
    input: AiPipelineInput;
    pathologist: PathologistResult;
    memories: AiMemoryChunk[];
  }): Promise<AiPipelineDecision> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (apiKey && process.env.LIA_JURIST_ENABLED !== 'false') {
      try {
        return await this.decideWithMistral(params, apiKey);
      } catch (e) {
        this.logger.warn('Mistral juriste indisponible, fallback simulation', e);
      }
    }
    return this.decideSimulated(params);
  }

  private async decideWithMistral(
    params: {
      input: AiPipelineInput;
      pathologist: PathologistResult;
      memories: AiMemoryChunk[];
    },
    apiKey: string,
  ): Promise<AiPipelineDecision> {
    const model = process.env.MISTRAL_MODEL ?? 'mistral-small-latest';
    const memoryBlock = this.aiMemory.formatForPrompt(params.memories);
    const patho = params.pathologist;

    const system = [
      'Tu es le juriste d un bailleur social (2terHabitat, Guyane).',
      'Tu tranches la responsabilité : BAILLEUR, LOCATAIRE, SOCIAL, NON_RECEVABLE, ESCALADE_BAILLEUR ou PENDING.',
      'Réponds en JSON uniquement : responsibility, nonRecevableReason (ou null), message (français simple pour le locataire), socialFlag, rationale.',
      'Priorité aux extraits FAQ les plus pertinents au cas (ex. fuite sous évier/robinet = LOCATAIRE sauf canalisation collective).',
      'Ne classe pas à la charge du bailleur une simple fuite de siphon ou robinet sous évier.',
    ].join(' ');

    const user = [
      'Extraits réglementaires :',
      memoryBlock,
      '',
      'Diagnostic pathologiste :',
      JSON.stringify(patho),
      '',
      'Signalement locataire :',
      `Titre: ${params.input.title}`,
      `Description: ${params.input.description}`,
      params.input.tenantFeedback
        ? `Précision: ${params.input.tenantFeedback}`
        : '',
    ].join('\n');

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      throw new Error(`Mistral HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Réponse Mistral vide');

    const parsed = parseJsonFromLlm<MistralJuristJson>(text);
    return this.toDecision(params.pathologist, parsed, [
      {
        name: 'pathologist',
        decision: patho.category,
        confidence: patho.confidence,
        extra: { fromLlm: patho.fromLlm },
      },
      {
        name: 'jurist_mistral',
        decision: parsed.responsibility,
        extra: { rationale: parsed.rationale },
      },
    ]);
  }

  private decideSimulated(params: {
    input: AiPipelineInput;
    pathologist: PathologistResult;
    memories: AiMemoryChunk[];
  }): AiPipelineDecision {
    const patho = params.pathologist;
    const text = this.normalizeText(
      `${params.input.title} ${params.input.description} ${params.input.tenantFeedback ?? ''}`,
    );
    const topMemory = params.memories[0];

    const steps: AiPipelineDecision['pipelineSteps'] = [
      {
        name: 'pathologist',
        decision: patho.category,
        confidence: patho.confidence,
        extra: { fromLlm: patho.fromLlm, simulation: !patho.fromLlm },
      },
    ];

    if (patho.category === 'SOCIAL_SIGNAL') {
      return {
        responsibility: 'SOCIAL',
        category: 'SOCIAL',
        severity: patho.severity,
        confidence: patho.confidence,
        needsMorePhoto: false,
        socialFlag: true,
        message:
          'Votre situation va être transmise à un référent social du bailleur. Vous serez recontacté(e) prochainement.',
        pipelineSteps: [
          ...steps,
          { name: 'jurist_simulation', decision: 'SOCIAL' },
        ],
      };
    }

    if (
      text.includes('voisin') &&
      (text.includes('bruit') || text.includes('dispute'))
    ) {
      return {
        responsibility: 'NON_RECEVABLE',
        nonRecevableReason: 'JURIDIQUE_VOISIN' as NonRecevableReason,
        category: 'OTHER',
        severity: 'LOW',
        confidence: 0.85,
        needsMorePhoto: false,
        socialFlag: false,
        message:
          'Ce type de litige relève du juridique entre voisins, pas du bailleur.',
        pipelineSteps: [
          ...steps,
          { name: 'jurist_simulation', decision: 'NON_RECEVABLE' },
        ],
      };
    }

    if (patho.needsMorePhoto) {
      return {
        responsibility: 'PENDING',
        category: patho.category,
        severity: patho.severity,
        confidence: patho.confidence,
        needsMorePhoto: true,
        socialFlag: false,
        message:
          'Pouvez-vous ajouter une photo claire du problème pour affiner l’analyse ?',
        pipelineSteps: [
          ...steps,
          { name: 'jurist_simulation', decision: 'NEEDS_MORE_PHOTO' },
        ],
      };
    }

    // --- Règles métier prioritaires (évite le mélange de toutes les mémoires RAG) ---
    const underFixtureKeywords = [
      'evier',
      'levier',
      'siphon',
      'robinet',
      'flexible',
      'lavabo',
      'fuite sous',
    ];
    const collectiveKeywords = [
      'colonne',
      'parties communes',
      'toiture',
      'façade',
      'facade',
      'canalisation encastr',
      'réseau collectif',
      'reseau collectif',
      'mur porteur',
    ];
    const isUnderFixture = underFixtureKeywords.some((k) => text.includes(k));
    const isCollective = collectiveKeywords.some((k) => text.includes(k));
    const faqSink = topMemory
      ? ['evier', 'robinet'].some((k) =>
          this.normalizeText(topMemory.title).includes(k),
        )
      : false;

    if (
      patho.category === 'PLUMBING' &&
      (isUnderFixture || faqSink) &&
      !isCollective
    ) {
      return {
        responsibility: 'LOCATAIRE',
        category: patho.category,
        severity: patho.severity,
        confidence: Math.max(patho.confidence, 0.8),
        needsMorePhoto: false,
        socialFlag: false,
        suggestedArtisanType: patho.suggestedArtisanType ?? 'PLUMBER',
        message:
          `Ce type d’intervention relève de l’entretien locatif (à votre charge). ` +
          `Vous pouvez répondre « je veux un plombier » pour être mis(e) en relation — un devis vous sera proposé.`,
        pipelineSteps: [
          ...steps,
          {
            name: 'jurist_simulation',
            decision: 'LOCATAIRE',
            extra: { rule: 'plumbing_under_fixture', memoryId: topMemory?.id },
          },
        ],
      };
    }

    const bailleurHints = [
      'colonne',
      'toiture',
      'façade',
      'facade',
      'fissure structure',
      'parties communes',
      'canalisation encastr',
    ];
    const isBailleurHint = bailleurHints.some((k) => text.includes(k));

    const humidityBailleur =
      patho.category === 'HUMIDITY' &&
      (text.includes('toiture') ||
        text.includes('façade') ||
        text.includes('facade') ||
        text.includes('infiltration') ||
        text.includes('mur porteur'));

    if (isBailleurHint || humidityBailleur) {
      return {
        responsibility: 'BAILLEUR',
        category: patho.category,
        severity: patho.severity,
        confidence: Math.max(patho.confidence, 0.78),
        needsMorePhoto: false,
        socialFlag: false,
        message:
          'Cette intervention relève du bailleur. Un agent va vous recontacter.',
        pipelineSteps: [
          ...steps,
          { name: 'jurist_simulation', decision: 'BAILLEUR' },
        ],
      };
    }

    if (patho.severity === 'HIGH' && isCollective) {
      return {
        responsibility: 'BAILLEUR',
        category: patho.category,
        severity: patho.severity,
        confidence: Math.max(patho.confidence, 0.85),
        needsMorePhoto: false,
        socialFlag: false,
        message: 'Urgent : un agent du bailleur a été notifié immédiatement.',
        pipelineSteps: [
          ...steps,
          { name: 'jurist_simulation', decision: 'BAILLEUR_URGENT' },
        ],
      };
    }

    if (patho.confidence < 0.45 && params.input.attempt >= 2) {
      return {
        responsibility: 'ESCALADE_BAILLEUR',
        category: patho.category,
        severity: patho.severity,
        confidence: patho.confidence,
        needsMorePhoto: false,
        socialFlag: false,
        message:
          'Nous n’arrivons pas à qualifier précisément votre demande. Un agent du bailleur va prendre le relais.',
        pipelineSteps: [
          ...steps,
          { name: 'jurist_simulation', decision: 'ESCALADE_BAILLEUR' },
        ],
      };
    }

    return {
      responsibility: 'LOCATAIRE',
      category: patho.category,
      severity: patho.severity,
      confidence: patho.confidence,
      needsMorePhoto: false,
      socialFlag: false,
      suggestedArtisanType: patho.suggestedArtisanType,
      message:
        `Ce type d’intervention relève de l’entretien locatif (à votre charge). ` +
        `Vous pouvez répondre « je veux un plombier » pour être mis(e) en relation — un devis vous sera proposé.`,
      pipelineSteps: [
        ...steps,
        { name: 'jurist_simulation', decision: 'LOCATAIRE' },
      ],
    };
  }

  /** Minuscules + sans accents (lévier → levier, évier → evier). */
  private normalizeText(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  private toDecision(
    pathologist: PathologistResult,
    jurist: MistralJuristJson,
    pipelineSteps: AiPipelineDecision['pipelineSteps'],
  ): AiPipelineDecision {
    const responsibility = jurist.responsibility as TicketResponsibility;
    return {
      responsibility,
      category: pathologist.category,
      severity: pathologist.severity,
      confidence: pathologist.confidence,
      needsMorePhoto: responsibility === 'PENDING',
      socialFlag: Boolean(jurist.socialFlag),
      message: jurist.message,
      suggestedArtisanType:
        responsibility === 'LOCATAIRE'
          ? pathologist.suggestedArtisanType
          : undefined,
      nonRecevableReason:
        jurist.nonRecevableReason ?? undefined,
      pipelineSteps,
    };
  }
}
