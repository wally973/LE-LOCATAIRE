import { loadGoldenScenarios } from './lia-golden-scenarios.loader';
import {
  evaluateOpeningStep,
  evaluateTurnStep,
} from './lia-golden-evaluator';
import type { GoldenDialogueStep } from './lia-golden-scenarios.types';
import { LiaIntakeService } from '../orchestrateur/intake/lia-intake.service';

describe('Scénarios or (structure)', () => {
  const file = loadGoldenScenarios();

  it('charge 10 scénarios', () => {
    expect(file.scenarios).toHaveLength(10);
    expect(file.scenarios.map((s) => s.id)).toContain('OR-03-menuiserie-gache');
  });

  it('chaque scénario a un id et des attentes', () => {
    for (const s of file.scenarios) {
      expect(s.id).toMatch(/^OR-/);
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.expectations).toBeDefined();
    }
  });

  it('intake initial en mode llm_first sans question scriptée', () => {
    const intake = new LiaIntakeService();
    const s = file.scenarios.find((x) => x.id === 'OR-03-menuiserie-gache')!;
    const state = intake.createInitialState(s.title, s.description);
    expect(state.intakeMode).toBe('llm_first');
    expect(intake.getCurrentQuestion(state)).toBeNull();
  });
});

describe('Évaluateur or (sans LLM)', () => {
  const scenario = loadGoldenScenarios().scenarios.find(
    (s) => s.id === 'OR-03-menuiserie-gache',
  )!;

  it('rejette les phrases interdites', () => {
    const step: GoldenDialogueStep = {
      acknowledgment: 'Bonjour',
      nextQuestion: 'Où exactement se situe le problème ?',
      combinedHostText:
        'Marie, merci.\nOù exactement se situe le problème ?',
      intakePhase: 'INTAKE',
      preferredLanguage: 'fr',
    };
    const issues = evaluateOpeningStep(scenario, step);
    expect(issues.some((i) => i.rule === 'mustNotContain')).toBe(true);
  });

  it('accepte une reformulation menuiserie', () => {
    const step: GoldenDialogueStep = {
      acknowledgment:
        'Marie, j’ai noté la gâche cassée sur la porte de la chambre de votre fils. Je transmets au bailleur.',
      nextQuestion: 'La porte ferme-t-elle encore ?',
      combinedHostText:
        'Marie, j’ai noté la gâche cassée sur la porte de la chambre de votre fils. Je transmets au bailleur.\nLa porte ferme-t-elle encore ?',
      intakePhase: 'DONE',
      preferredLanguage: 'fr',
    };
    const issues = evaluateOpeningStep(scenario, step);
    expect(issues).toHaveLength(0);
  });
});
