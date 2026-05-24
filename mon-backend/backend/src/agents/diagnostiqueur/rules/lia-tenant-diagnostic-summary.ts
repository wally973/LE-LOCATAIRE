/**
 * Synthèse lisible pour le locataire après diagnostic (Savoir-Voir).
 */
import type { AiPipelineDecision } from '../../../ai-routing/ai-pipeline.port';
import type { PathologistResult } from '../../../ai-routing/agents/pathologist.types';
import type { LiaIntakeState } from '../../orchestrateur/intake/lia-intake.service';
import { parseElectricitySignals, resolveElectricityCharge } from './lia-electricity-rules';
import { buildTenantCaseContext } from '../../shared/lia-case-context';
import type { DiagnosticSensors } from '../../shared/lia-diagnostic-state.types';
import {
  formatDiagnosticModeHeader,
  formatSensorDetailLines,
} from '../../shared/diagnostic-sensor-summary';

const PATHO_CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: 'Plomberie',
  ELECTRICITY: 'Électricité / éclairage',
  ROOF: 'Toiture',
  GENERIC: 'Général',
  HUMIDITY: 'Humidité',
  HEATING: 'Chauffage',
  LOCKSMITH: 'Serrurerie',
  CARPENTRY: 'Menuiserie',
  OTHER: 'Autre',
};

function pathoCategoryLabel(category: string): string {
  return PATHO_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}

const RESPONSIBILITY_LABELS: Record<string, string> = {
  BAILLEUR: 'charge bailleur (intervention organisée par le bailleur)',
  LOCATAIRE: 'charge locataire (entretien / menue réparation)',
  ESCALADE_BAILLEUR: 'à affiner par un agent du bailleur',
  PENDING: 'analyse en cours',
  SOCIAL: 'orientation référent social',
  NON_RECEVABLE: 'hors périmètre bailleur',
};

function intakeHighlights(intake: LiaIntakeState | null | undefined): string[] {
  if (!intake) return [];
  const lines: string[] = [];
  const a = intake.answers ?? {};
  if (a.bulb_action?.trim()) {
    lines.push(`Ampoule : ${a.bulb_action.trim()}`);
  }
  if (a.switch_ok?.trim()) {
    lines.push(`Interrupteur : ${a.switch_ok.trim()}`);
  }
  if (a.room_breaker?.trim()) {
    lines.push(`Disjoncteur du circuit : ${a.room_breaker.trim()}`);
  }
  if (a.socket_check?.trim()) {
    lines.push(`Douille / support : ${a.socket_check.trim()}`);
  }
  if (a.scope?.trim()) {
    lines.push(`Périmètre : ${a.scope.trim()}`);
  }
  if (a.photo_unavailable?.trim()) {
    lines.push('Photo : non disponible (analyse sur vos réponses uniquement)');
  }
  if (intake.signals?.roomHint) {
    lines.push(`Pièce : ${intake.signals.roomHint}`);
  }
  return lines;
}

/** Message en deux parties : synthèse + décision. */
export function buildTenantDiagnosticMessage(params: {
  decision: Pick<AiPipelineDecision, 'responsibility' | 'message' | 'category'>;
  pathologist: PathologistResult;
  intake?: LiaIntakeState | null;
  title: string;
  description: string;
  tenantSupplement?: string;
  sensors?: DiagnosticSensors;
}): string {
  const { decision, pathologist, intake, title, description, tenantSupplement, sensors } =
    params;
  const caseContext = buildTenantCaseContext({
    title,
    description,
    intake,
    tenantSupplement,
  });

  const highlights = intakeHighlights(intake);
  const respLabel =
    RESPONSIBILITY_LABELS[decision.responsibility] ??
    decision.responsibility;

  const reasoning: string[] = [];
  if (pathologist.category === 'ELECTRICITY') {
    const signals = parseElectricitySignals(caseContext);
    const charge = resolveElectricityCharge(signals, caseContext);
    if (charge === 'BAILLEUR') {
      reasoning.push(
        'Électricité : installation fixe ou défaut depuis l’emménagement / remise en état.',
      );
    } else if (charge === 'LOCATAIRE') {
      reasoning.push(
        'Électricité : ampoule, interrupteur ou douille accessible (entretien locatif).',
      );
    } else if (charge === 'ESCALADE_BAILLEUR') {
      reasoning.push('Électricité : éléments contradictoires — agent bailleur.');
    }
  }

  const blocks: string[] = [];
  const modeHeader = formatDiagnosticModeHeader(sensors);
  if (modeHeader) {
    blocks.push(modeHeader);
  }
  const sensorLines = formatSensorDetailLines(sensors);
  if (sensorLines.length > 0) {
    blocks.push('Capteurs retenus :');
    blocks.push(...sensorLines);
    blocks.push('');
  }
  blocks.push('Synthèse de l’analyse');
  blocks.push(`• Sujet : ${pathoCategoryLabel(pathologist.category)}`);
  if (pathologist.observation?.trim()) {
    blocks.push(`• Constat technique : ${pathologist.observation.trim()}`);
  }
  if (highlights.length > 0) {
    blocks.push(`• Vos réponses retenues : ${highlights.join(' ; ')}`);
  }
  if (reasoning.length > 0) {
    blocks.push(`• Logique appliquée : ${reasoning.join(' ')}`);
  }
  blocks.push(`• Orientation retenue : ${respLabel}`);
  blocks.push('');
  blocks.push(decision.message.trim());

  return blocks.join('\n');
}
