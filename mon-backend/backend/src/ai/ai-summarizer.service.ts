import { Injectable } from '@nestjs/common';
import type { DiagnosticSensors } from '../agents/shared/lia-diagnostic-state.types';
import {
  formatDiagnosticModeHeader,
  formatSensorDetailLines,
} from '../agents/shared/diagnostic-sensor-summary';
import type { PathologistResult } from '../ai-routing/agents/pathologist.types';
import type { AiPipelineDecision } from '../ai-routing/ai-pipeline.port';
import { buildTenantDiagnosticMessage } from '../agents/diagnostiqueur/rules/lia-tenant-diagnostic-summary';
import type { LiaIntakeState } from '../agents/orchestrateur/intake/lia-intake.service';

export interface TenantSummaryInput {
  ticket: { id: number; title: string; description: string };
  decision: Pick<
    AiPipelineDecision,
    'responsibility' | 'message' | 'category' | 'confidence'
  >;
  pathologist: PathologistResult;
  sensors: DiagnosticSensors;
  intake?: LiaIntakeState | null;
  tenantSupplement?: string;
  insuranceNotes?: string[];
  legalSummary?: string | null;
}

/**
 * Synthèses finales — intègre tous les capteurs (Savoir-Voir Phase 4).
 */
@Injectable()
export class AiSummarizerService {
  /** Résumé structuré pour le locataire après pipeline complet. */
  buildTenantFinalSummary(input: TenantSummaryInput): string {
    const core = buildTenantDiagnosticMessage({
      decision: input.decision,
      pathologist: input.pathologist,
      intake: input.intake,
      title: input.ticket.title,
      description: input.ticket.description,
      tenantSupplement: input.tenantSupplement,
      sensors: input.sensors,
    });

    const extras: string[] = [];
    if (input.insuranceNotes?.length) {
      extras.push('Assurance / sinistre :');
      for (const n of input.insuranceNotes) {
        extras.push(`• ${n}`);
      }
    }
    if (input.legalSummary?.trim()) {
      extras.push(`Juridique : ${input.legalSummary.trim()}`);
    }
    if (!extras.length) {
      return core;
    }
    const decisionLine = input.decision.message.trim();
    const withoutDupDecision = core.endsWith(decisionLine)
      ? core.slice(0, -decisionLine.length).trimEnd()
      : core;
    return [...withoutDupDecision.split('\n'), '', ...extras, '', decisionLine].join(
      '\n',
    );
  }

  /**
   * Résumé automatique d'un ticket pour bailleur (legacy).
   */
  generateSummary(
    ticket: { id: number; title: string; description: string },
    diagnostic: {
      category?: string;
      severity?: string;
      responsibility?: string;
      risks?: string[];
    } | null,
    dispatch: {
      type?: string;
      urgency?: string;
      estimatedDelay?: string;
      estimatedCost?: string;
    } | null,
    priority: { priority?: string; score?: number } | null,
    sensors?: DiagnosticSensors,
  ) {
    const lines: string[] = [];

    const modeHeader = formatDiagnosticModeHeader(sensors);
    if (modeHeader) {
      lines.push(modeHeader);
    }
    for (const s of formatSensorDetailLines(sensors)) {
      lines.push(s);
    }
    if (modeHeader || formatSensorDetailLines(sensors).length) {
      lines.push('');
    }

    lines.push(`📌 *Résumé du ticket #${ticket.id}*`);
    lines.push(`- Problème déclaré : ${ticket.title}`);
    lines.push(`- Description : ${ticket.description}`);

    if (diagnostic) {
      lines.push(`- Catégorie IA : ${diagnostic.category}`);
      lines.push(`- Gravité : ${diagnostic.severity}`);
      lines.push(`- Responsabilité probable : ${diagnostic.responsibility}`);
      if (diagnostic.risks?.length)  {
        lines.push(`- Risques détectés : ${diagnostic.risks.join(', ')}`);
      }
    }

    if (dispatch) {
      lines.push(`- Type d’artisan suggéré : ${dispatch.type}`);
      lines.push(`- Urgence : ${dispatch.urgency}`);
      lines.push(`- Délai estimé : ${dispatch.estimatedDelay}`);
      lines.push(`- Coût estimé : ${dispatch.estimatedCost}`);
    }

    if (priority) {
      lines.push(`- Priorité globale : ${priority.priority}`);
      lines.push(`- Score IA : ${priority.score}`);
    }

    return lines.join('\n');
  }
}
