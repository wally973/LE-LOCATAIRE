import { Injectable } from '@nestjs/common';
import { LiaHostService } from '../../agents/orchestrateur/conversation/lia-host.service';
import {
  GROCK_MISTRAL_FALLBACK_MODEL,
  GROCK_MISTRAL_MODEL,
  GROCK_MISTRAL_VISION_FALLBACK_MODEL,
  GROCK_VISION_MODEL,
} from '../../agents/orchestrateur/living-intelligence/living-intelligence.config';
import type {
  LlmOperatorPort,
  LlmOperatorResult,
  LlmReasoningRequest,
  LlmVisionRequest,
} from './llm-operator.port';

/**
 * Implémentation du PORT IA branchée sur Mistral.
 *
 * C'est le SEUL endroit du noyau Grock qui nomme « Mistral » et choisit les
 * modèles. Pour brancher un autre opérateur (GPT, Claude, Llama…), on écrit une
 * autre classe implémentant `LlmOperatorPort` sans toucher au noyau.
 */
@Injectable()
export class MistralOperator implements LlmOperatorPort {
  constructor(private readonly host: LiaHostService) {}

  isConfigured(): boolean {
    return this.host.isMistralConfigured();
  }

  async reason(
    request: LlmReasoningRequest,
  ): Promise<LlmOperatorResult | null> {
    // Avec image : repli vision-capable (sinon HTTP 400). Sans image : repli texte.
    const fallbackModel = request.images?.length
      ? GROCK_MISTRAL_VISION_FALLBACK_MODEL
      : GROCK_MISTRAL_FALLBACK_MODEL;
    return this.host.chatMultiTurnMistral(
      request.systemPrompt,
      request.turns,
      request.maxTokens,
      {
        model: GROCK_MISTRAL_MODEL,
        fallbackModel,
        timeoutMs: request.timeoutMs,
        json: request.json,
        images: request.images,
      },
    );
  }

  async see(request: LlmVisionRequest): Promise<LlmOperatorResult | null> {
    const mime = request.image.mimeType?.trim() || 'image/jpeg';
    return this.host.chatVisionMistral(
      request.systemPrompt,
      request.userText,
      `data:${mime};base64,${request.image.base64}`,
      request.maxTokens,
      { model: GROCK_VISION_MODEL, timeoutMs: request.timeoutMs },
    );
  }

  describeFailure(): string {
    const err = this.host.getLastGroqError();
    if (err?.httpStatus === 429) {
      return 'Opérateur IA saturé (quota) — réessayez dans 1 à 2 minutes.';
    }
    if (err?.reason === 'missing_api_key') {
      return 'MISTRAL_API_KEY absente dans mon-backend/backend/.env — redémarrez le backend.';
    }
    return 'Opérateur IA indisponible — réessayez.';
  }
}
