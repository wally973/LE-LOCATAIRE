/**
 * Raisonnement Jarvis — simulation physique partagée entre dialogue et diagnostic.
 */
import type { LiaIntakeState } from './lia-intake.service';
import { loadVisualLogicBrief } from './lia-jarvis-visual-logic';
import { parseSimulationFromState } from './lia-jarvis-simulation.engine';

/** Enrichit le contexte envoyé au pathologiste / juriste (KB, pas script). */
export function buildJarvisDiagnosticEnrichment(
  intake?: LiaIntakeState | null,
): string {
  if (!intake) return '';
  const sim = parseSimulationFromState(intake);
  const lines: string[] = [
    '--- Agent Jarvis — simulation physique (Savoir-Voir) ---',
    'Modèles : Exutoire (3 verres), Dalle froide (R-1/R+1), Enveloppe (toiture → étages bas).',
  ];

  if (sim) {
    lines.push(`Domaine simulation : ${sim.domain}`);
    if (sim.scene.floorLevel) lines.push(`Altimétrie : ${sim.scene.floorLevel}`);
    if (sim.scene.room) lines.push(`Pièce : ${sim.scene.room}`);
    if (sim.scene.above) lines.push(`Au-dessus : ${sim.scene.above}`);
    if (sim.scene.below) lines.push(`En-dessous : ${sim.scene.below}`);
    lines.push(`Flux actifs : ${sim.activeFlows.join(', ')}`);
    if (sim.mentalModels.length) {
      lines.push('Modèles mentaux :', ...sim.mentalModels.map((m) => `- ${m}`));
    }
    const activeHypos = sim.hypotheses.filter((h) => h.active);
    if (activeHypos.length) {
      lines.push(
        'Hypothèses simulées :',
        ...activeHypos.map((h) => `- ${h.label} : ${h.visualization}`),
      );
    }
    if (sim.visualizationSummary) {
      lines.push(`Synthèse visualisation : ${sim.visualizationSummary}`);
    }
  }

  if (intake.jarvisFacts?.visualization) {
    lines.push(`Visualisation retenue : ${intake.jarvisFacts.visualization}`);
  }
  const facts = Object.entries(intake.jarvisFacts ?? {})
    .filter(([k]) => !['visualization', 'jarvis_simulation'].includes(k))
    .map(([k, v]) => `${k}: ${v}`);
  if (facts.length) {
    lines.push('Faits acquis (extraction 360°) :', ...facts);
  }
  if (intake.answers.jarvis_summary) {
    lines.push(`Synthèse dialogue : ${intake.answers.jarvis_summary}`);
  }
  return lines.join('\n');
}

/** Contexte court pour prompts Groq (polish optionnel). */
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

/**
 * Détecte une contradiction physique évidente → handoff humain recommandé.
 */
export function detectJarvisPhysicalContradiction(
  signalementText: string,
  intake?: LiaIntakeState | null,
): { contradictory: boolean; reason?: string } {
  const t = signalementText.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  const localPlumbing =
    /sous.*(evier|évier|lavabo)|fuite.*(evier|évier|lavabo)/.test(t);

  if (intake?.answers.jarvis_handoff === 'oui') {
    return { contradictory: true, reason: 'Handoff Jarvis déjà déclenché.' };
  }

  if (
    localPlumbing &&
    /r\+6|toiture terrasse|dernier etage/.test(t) &&
    !/plafond|infiltr/.test(t)
  ) {
    return {
      contradictory: true,
      reason:
        'Signalement étage courant vs mention toiture terrasse sans trajet d’eau décrit — visualisation enveloppe incomplète.',
    };
  }

  return { contradictory: false };
}
