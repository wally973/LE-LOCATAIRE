import { Injectable, Logger } from '@nestjs/common';
import type {
  AiPipelineDecision,
  AiPipelineInput,
  AiPipelinePort,
} from './ai-pipeline.port';
import { AiMemoryService } from './ai-memory.service';
import { LiaPathologistService } from './agents/lia-pathologist.service';
import { LiaJuristService } from './agents/lia-jurist.service';
import { AiPipelineStubAdapter } from './ai-pipeline-stub.adapter';

/**
 * Pipeline Sprint G : pathologiste (Gemini) → juriste (Mistral + AiMemory).
 * Repli sur le stub Sprint 3 si une étape échoue.
 */
@Injectable()
export class AiPipelineLiaAdapter implements AiPipelinePort {
  private readonly logger = new Logger(AiPipelineLiaAdapter.name);

  constructor(
    private readonly pathologist: LiaPathologistService,
    private readonly jurist: LiaJuristService,
    private readonly aiMemory: AiMemoryService,
    private readonly stub: AiPipelineStubAdapter,
  ) {}

  async analyze(input: AiPipelineInput): Promise<AiPipelineDecision> {
    try {
      const patho = await this.pathologist.analyze(input);
      const query = [
        input.title,
        input.description,
        input.tenantFeedback ?? '',
        patho.category,
      ]
        .join(' ')
        .trim();
      const memories = await this.aiMemory.searchRelevant({
        landlordProfileId: input.landlordProfileId,
        housingId: input.housingId,
        query,
        category: patho.category,
        limit: 6,
      });
      return await this.jurist.decide({ input, pathologist: patho, memories });
    } catch (e) {
      this.logger.error('Pipeline Lia en échec — repli stub', e);
      return this.stub.analyze(input);
    }
  }
}
