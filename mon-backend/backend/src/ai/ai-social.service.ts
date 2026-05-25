import { Injectable } from '@nestjs/common';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import {
  classifySocialRiskFromText,
  type SocialRiskAssessment,
} from '../agents/shared/diagnostic-ticket-insights';

@Injectable()
export class AiSocialService {
  constructor(
    private readonly diagnosticContext: DiagnosticContextService,
  ) {}

  async analyzeSocialRisk(description: string): Promise<SocialRiskAssessment> {
    return classifySocialRiskFromText(description);
  }

  /** Contexte ticket déclencheur d’un dossier social (intake + capteurs Lia). */
  async analyzeSocialRiskForTicket(ticketId: number) {
    const ctx = await this.diagnosticContext.fromTicket(ticketId);
    const assessment = classifySocialRiskFromText(ctx.caseContext);
    return {
      ...assessment,
      ticketId,
      savoirVoirPhase: ctx.savoirVoirPhase,
      sensors: ctx.sensors,
    };
  }
}
