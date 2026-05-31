/**
 * Smoke test Lia-Lab — ouverture Jarvis sans HTTP.
 * Usage : npx ts-node --transpile-only scripts/test-lia-lab-open.ts
 */
import { buildLabVisualization } from '../src/lia-lab/lia-lab-visualization';
import type { LiaIntakeState } from '../src/agents/orchestrateur/intake/lia-intake.service';
import {
  applyJarvis360ToState,
  ensureJarvisOrganizer,
} from '../src/agents/orchestrateur/intake/lia-jarvis-intake.engine';
import {
  buildJarvisConsultation,
  runJarvisSimulation,
  syncJarvisSimulationOnState,
} from '../src/agents/orchestrateur/intake/lia-jarvis-simulation.engine';

const title = 'Porte qui ne ferme plus';
const description =
  'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.';

const baseState: LiaIntakeState = {
  phase: 'INTAKE',
  category: 'GENERIC',
  stepIndex: 0,
  answers: {},
  signals: {},
  intakeTitle: title,
  intakeDescription: description,
  intakeMode: 'jarvis',
  jarvisFacts: {},
  skippedQuestionIds: [],
};

let state = ensureJarvisOrganizer(baseState, title, description);
state = applyJarvis360ToState(state, title, description);
state = syncJarvisSimulationOnState(state, title, description);

const sim = runJarvisSimulation({ title, description });
const consult = buildJarvisConsultation({
  simulation: sim,
  title,
  description,
  tenantFirstName: 'Marie',
  mode: 'opening',
});

const viz = buildLabVisualization({ state, title, description });

console.log('[ok] acknowledgment:', consult.acknowledgment.slice(0, 80));
console.log('[ok] question:', consult.nextQuestion?.slice(0, 80) ?? '(null)');
console.log('[ok] console langue:', viz.dialogueLanguageLabel);

if (!consult.acknowledgment.trim() || !consult.nextQuestion?.trim()) {
  console.error('[fail] ouverture vide');
  process.exitCode = 1;
}
