import { Inject, Injectable, Logger } from '@nestjs/common';
import type { GrockChatMessage } from '../grock.service';
import { LLM_OPERATOR, type LlmOperatorPort } from '../port/llm-operator.port';
import type { GrockInterlocutor } from '../kernel/grock-interlocutor';
import {
  GROCK_VISION_INVARIANT_USER_TEXT,
  GROCK_VISION_PERCEPTION_PROMPT,
} from '../grock-vision.prompt';
import type { GrockPreprocessorInput, PreprocessedSignal } from './preprocessor.types';
import { buildSignalementBlock } from './signalement-builder';
import { scoreSignalQuality } from './signal-quality.scorer';
import { countNormalizedFields, normalizeSignalText } from './text-normalizer';

/** Jeton d'injection NestJS — Couche 0 Grock. */
export const GROCK_PREPROCESSOR = Symbol('GROCK_PREPROCESSOR');

/**
 * Couche 0 — Préprocesseur Grock.
 *
 * Nettoie, normalise et contextualise image + texte selon le rôle.
 * Produit une perception brute invariante (sans diagnostic) pour les 5 têtes.
 */
@Injectable()
export class GrockPreprocessorService {
  private readonly logger = new Logger(GrockPreprocessorService.name);

  constructor(@Inject(LLM_OPERATOR) private readonly operator: LlmOperatorPort) {}

  async preprocess(input: GrockPreprocessorInput): Promise<PreprocessedSignal> {
    const interlocutor: GrockInterlocutor = input.interlocutor ?? 'tenant';

    const rawFields = [
      input.title,
      input.description,
      input.tenantMessage,
      input.tenantFirstName,
    ];
    const title = normalizeSignalText(input.title);
    const description = normalizeSignalText(input.description);
    const tenantMessage = normalizeSignalText(input.tenantMessage);
    const tenantFirstName = normalizeSignalText(input.tenantFirstName);

    const sessionMessages = this.normalizeSessionMessages(input.sessionMessages);

    const normCount =
      countNormalizedFields(rawFields, [
        title,
        description,
        tenantMessage,
        tenantFirstName,
      ]) + this.countSessionNormalization(input.sessionMessages, sessionMessages);

    const image = input.images?.[input.images.length - 1];
    let visualPerceptionRaw: string | null = null;
    let visionModel: string | null = null;

    if (image) {
      const perc = await this.runInvariantVisualPerception(image);
      if (perc) {
        visualPerceptionRaw = perc.perception;
        visionModel = perc.model;
      }
    }

    const signalementBlock = buildSignalementBlock({
      interlocutor,
      tenantFirstName,
      title,
      description,
    });

    const { signalQuality, factors: signalQualityFactors } = scoreSignalQuality({
      title,
      description,
      tenantMessage,
      sessionMessages,
      visualPerceptionRaw,
      hasImage: Boolean(image),
    });

    return {
      tenantFirstName,
      title,
      description,
      tenantMessage,
      sessionMessages,
      interlocutor,
      signalementBlock,
      visualPerceptionRaw,
      visionModel,
      signalQuality,
      signalQualityFactors,
      meta: {
        role: interlocutor,
        textFieldsNormalized: normCount,
        imageProcessed: visualPerceptionRaw != null,
      },
    };
  }

  /**
   * Perception visuelle invariante — aveugle au cadrage (titre, récit, rôle).
   * Élimine la variance de formulation sur la lecture des pixels.
   */
  async runInvariantVisualPerception(
    image: NonNullable<GrockPreprocessorInput['images']>[number],
  ): Promise<{ perception: string; model: string } | null> {
    const result = await this.operator.see({
      systemPrompt: GROCK_VISION_PERCEPTION_PROMPT,
      userText: GROCK_VISION_INVARIANT_USER_TEXT,
      image,
      maxTokens: 500,
      timeoutMs: 90_000,
    });

    if (!result?.text?.trim()) {
      this.logger.warn('[Préprocesseur] Perception visuelle vide ou indisponible');
      return null;
    }

    return { perception: result.text.trim(), model: result.model };
  }

  private normalizeSessionMessages(messages: GrockChatMessage[]): GrockChatMessage[] {
    return messages.map((m) => ({
      ...m,
      text: normalizeSignalText(m.text),
    }));
  }

  private countSessionNormalization(
    before: GrockChatMessage[],
    after: GrockChatMessage[],
  ): number {
    let n = 0;
    for (let i = 0; i < before.length; i++) {
      if (before[i]?.text !== after[i]?.text) n++;
    }
    return n;
  }
}
