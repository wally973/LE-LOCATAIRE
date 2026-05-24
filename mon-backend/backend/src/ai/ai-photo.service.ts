import { Injectable } from '@nestjs/common';
import { LiaPathologistService } from '../ai-routing/agents/lia-pathologist.service';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import type { PathologistResult } from '../ai-routing/agents/pathologist.types';

/**
 * Façade photo — délègue au pathologiste (vision + capteurs). Plus de stub GENERAL.
 */
@Injectable()
export class AiPhotoService {
  constructor(
    private readonly pathologist: LiaPathologistService,
    private readonly diagnosticContext: DiagnosticContextService,
  ) {}

  async analyzePhoto(
    photoUrl: string,
    opts?: { ticketId?: number; title?: string; description?: string },
  ) {
    if (opts?.ticketId) {
      const result = await this.pathologist.analyzePhotoForTicket(
        opts.ticketId,
        photoUrl,
      );
      return this.toLegacyShape(result);
    }

    const sensors = opts?.title
      ? (
          await this.diagnosticContext.fromParts({
            ticketId: 0,
            title: opts.title,
            description: opts.description ?? '',
            aiLastDecision: null,
          })
        ).sensors
      : {};

    const result = await this.pathologist.analyze({
      title: opts?.title ?? 'Analyse photo',
      description: opts?.description ?? '',
      attempt: 1,
      photoUrls: [photoUrl],
      diagnosticSensors: sensors,
      locale: 'fr-FR',
    });
    return this.toLegacyShape(result);
  }

  private toLegacyShape(result: PathologistResult) {
    return {
      category: result.category,
      description: result.observation,
      confidence: result.confidence,
      severity: result.severity,
      needsMorePhoto: result.needsMorePhoto,
      suggestedArtisanType: result.suggestedArtisanType,
      fromLlm: result.fromLlm,
      hvacPhoto: result.hvacPhoto,
      humidityPhoto: result.humidityPhoto,
      differential: result.differential,
    };
  }
}
