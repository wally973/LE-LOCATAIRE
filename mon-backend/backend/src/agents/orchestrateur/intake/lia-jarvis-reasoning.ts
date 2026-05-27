/**
 * Raisonnement Jarvis — simulation physique partagée entre dialogue et diagnostic.
 */
import type { LiaIntakeState } from './lia-intake.service';
import { loadVisualLogicBrief } from './lia-jarvis-visual-logic';

/** Enrichit le contexte envoyé au pathologiste / juriste (KB, pas script). */
export function buildJarvisDiagnosticEnrichment(
  intake?: LiaIntakeState | null,
): string {
  if (!intake) return '';
  const lines: string[] = [
    '--- Agent Jarvis — simulation physique (Savoir-Voir) ---',
    'Modèles : Exutoire (3 verres), Dalle froide (R-1/R+1), Enveloppe (toiture → étages bas).',
  ];
  if (intake.jarvisFacts?.visualization) {
    lines.push(`Visualisation retenue : ${intake.jarvisFacts.visualization}`);
  }
  const facts = Object.entries(intake.jarvisFacts ?? {})
    .filter(([k]) => k !== 'visualization')
    .map(([k, v]) => `${k}: ${v}`);
  if (facts.length) {
    lines.push('Faits acquis (extraction 360°) :', ...facts);
  }
  if (intake.answers.jarvis_summary) {
    lines.push(`Synthèse dialogue : ${intake.answers.jarvis_summary}`);
  }
  return lines.join('\n');
}

/** Contexte court pour prompts Groq (dialogue). */
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
 * (Complément au jugement LLM — filet de sécurité déterministe.)
 */
export function detectJarvisPhysicalContradiction(
  signalementText: string,
  intake?: LiaIntakeState | null,
): { contradictory: boolean; reason?: string } {
  const t = signalementText.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  const localPlumbing =
    /sous.*(evier|évier|lavabo)|fuite.*(evier|évier|lavabo)/.test(t);
  const roofOnlyHypothesis =
    intake?.organizer?.eliminatedCauseIds?.length === 0 &&
    /toiture|colonne|plafond/.test(
      Object.values(intake?.answers ?? {}).join(' '),
    ) &&
    localPlumbing;

  if (roofOnlyHypothesis) {
    return {
      contradictory: true,
      reason:
        'Fuite localisée sous équipement mais piste toiture/colonne sans lien dans le récit — expertise terrain requise.',
    };
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

  if (intake?.answers.jarvis_handoff === 'oui') {
    return { contradictory: true, reason: 'Handoff Jarvis déjà déclenché.' };
  }

  return { contradictory: false };
}
