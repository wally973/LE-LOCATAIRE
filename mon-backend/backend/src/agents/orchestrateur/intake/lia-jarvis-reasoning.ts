/**
 * Enrichissement diagnostic depuis LIVING_BUILDING_STATE (post-intake).
 */
import type { LiaIntakeState } from './lia-intake.service';
import { loadVisualLogicBrief } from './lia-jarvis-visual-logic';
import { readLivingStateFromIntake } from '../living-intelligence/living-building-state.repository';

export function buildJarvisDiagnosticEnrichment(
  intake?: LiaIntakeState | null,
): string {
  if (!intake) return '';
  const living = readLivingStateFromIntake(intake.jarvisFacts);
  const lines: string[] = [
    '--- Living Intelligence — LIVING_BUILDING_STATE ---',
    'Modèles : Exutoire (3 verres), Dalle froide (R-1/R+1), Enveloppe.',
  ];

  if (living) {
    const v = living.vision3d;
    if (v.floorLevel) lines.push(`Altimétrie : ${v.floorLevel}`);
    if (v.rooms.length) lines.push(`Pièces : ${v.rooms.join(', ')}`);
    if (v.above) lines.push(`Au-dessus : ${v.above}`);
    if (v.below) lines.push(`En-dessous : ${v.below}`);
    if (v.activeFlows.length) lines.push(`Flux actifs : ${v.activeFlows.join(', ')}`);
    if (v.mentalModels.length) {
      lines.push('Modèles mentaux :', ...v.mentalModels.map((m) => `- ${m}`));
    }
    const activeHypos = v.hypotheses.filter((h) => h.active);
    if (activeHypos.length) {
      lines.push(
        'Hypothèses :',
        ...activeHypos.map((h) => `- ${h.label} : ${h.visualization}`),
      );
    }
    if (living.intervention.technicianSummary) {
      lines.push(`Synthèse technicien : ${living.intervention.technicianSummary}`);
    }
    if (living.legalVerdict.summary) {
      lines.push(`Verdict légal : ${living.legalVerdict.summary}`);
    }
  }

  if (intake.answers.jarvis_summary) {
    lines.push(`Synthèse dialogue : ${intake.answers.jarvis_summary}`);
  }
  return lines.join('\n');
}

export function buildJarvisDialogueContext(
  intake?: LiaIntakeState | null,
  signalement?: string,
): string {
  const brief = loadVisualLogicBrief();
  const enrichment = buildJarvisDiagnosticEnrichment(intake);
  return [brief.slice(0, 2800), signalement ?? '', enrichment]
    .filter(Boolean)
    .join('\n\n');
}

/** Contradiction physique évidente — handoff humain. */
export function detectJarvisPhysicalContradiction(
  signalementText: string,
  intake?: LiaIntakeState | null,
): { contradictory: boolean; reason?: string } {
  const t = signalementText.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  if (intake?.answers.jarvis_handoff === 'oui') {
    return { contradictory: true, reason: 'Handoff déjà déclenché.' };
  }

  if (
    /sous.*(evier|évier|lavabo)|fuite.*(evier|évier|lavabo)/.test(t) &&
    /r\+6|toiture terrasse|dernier etage/.test(t) &&
    !/plafond|infiltr/.test(t)
  ) {
    return {
      contradictory: true,
      reason:
        'Signalement étage courant vs toiture terrasse sans trajet d’eau décrit.',
    };
  }

  return { contradictory: false };
}
