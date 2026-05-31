import { inferHousingPerspective } from './lia-housing-perspective';
import { pickCouncilSpokenQuestion, runCouncilRound } from './lia-jarvis-council.engine';
import {
  assertTextPatterns,
  loadJarvisTrainingScenarios,
  type TrainingScenario,
  type TrainingScenarioExpect,
} from './lia-jarvis-training-scenarios.loader';
import {
  buildJarvisConsultation,
  runJarvisSimulation,
} from './lia-jarvis-simulation.engine';
import { pickChainQuestion } from './lia-jarvis-visual-chain';
import type { LiaIntakeState } from './lia-intake.service';

const emptyState = {} as LiaIntakeState;

function runOpeningConsultation(scenario: TrainingScenario) {
  const housing = inferHousingPerspective(scenario.housingUnit);
  const sim = runJarvisSimulation({
    title: scenario.title,
    description: scenario.description,
    preferredLanguage: 'fr',
    housingKind: housing.kind,
  });
  const consult = buildJarvisConsultation({
    simulation: sim,
    title: scenario.title,
    description: scenario.description,
    tenantFirstName: 'Marie',
    mode: 'opening',
  });
  const councilRound = runCouncilRound({
    title: scenario.title,
    description: scenario.description,
    message: '',
    state: emptyState,
    simulation: sim,
    housing,
    chainQuestion: pickChainQuestion(sim, 'fr'),
  });
  const spokenQuestion = pickCouncilSpokenQuestion(
    consult.nextQuestion,
    councilRound,
    sim.resolvedSteps,
  );
  return { sim, consult, councilRound, spokenQuestion, housing };
}

function assertExpectations(
  rules: TrainingScenarioExpect,
  params: {
    sim: ReturnType<typeof runJarvisSimulation>;
    acknowledgment: string;
    nextQuestion: string | null;
    councilAgents?: string[];
  },
) {
  if (rules.expectDomain) {
    expect(params.sim.domain).toBe(rules.expectDomain);
  }
  if (rules.expectActiveFlows?.length) {
    for (const flow of rules.expectActiveFlows) {
      expect(params.sim.activeFlows).toContain(flow);
    }
  }
  if (rules.expectIntakeComplete != null) {
    expect(params.sim.intakeComplete).toBe(rules.expectIntakeComplete);
  }
  assertTextPatterns(params.acknowledgment, rules.ackMustNotMatch, 'mustNotMatch');
  const questionMustNot = rules.allowsGenericFallbackQuestion
    ? rules.questionMustNotMatch?.filter((p) => !/sans tout répéter/i.test(p))
    : rules.questionMustNotMatch;
  assertTextPatterns(params.nextQuestion, rules.questionMustMatch, 'mustMatch');
  assertTextPatterns(params.nextQuestion, questionMustNot, 'mustNotMatch');
  if (rules.allowsGenericFallbackQuestion) {
    expect(params.nextQuestion?.trim().length).toBeGreaterThan(0);
  }
  if (rules.expectCouncilAgents?.length) {
    for (const agent of rules.expectCouncilAgents) {
      expect(params.councilAgents).toContain(agent);
    }
  }
}

describe('lia-jarvis-training-scenarios — entraînement équipe (nouvelles situations)', () => {
  const scenarios = loadJarvisTrainingScenarios();

  it('catalogue — au moins 10 thèmes distincts', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(10);
    const themes = new Set(scenarios.map((s) => s.theme));
    expect(themes.size).toBeGreaterThanOrEqual(10);
  });

  describe.each(scenarios.map((s) => [s.id, s] as const))(
    'ouverture [%s]',
    (_id, scenario) => {
      it(`thème « ${scenario.theme} » — Jarvis écoute, pas de jargon, question utile`, () => {
        const { sim, consult, councilRound, spokenQuestion } =
          runOpeningConsultation(scenario);

        expect(consult.acknowledgment.trim().length).toBeGreaterThan(10);
        expect(consult.visualizationNote.length).toBeGreaterThan(5);

        assertExpectations(scenario.opening, {
          sim,
          acknowledgment: consult.acknowledgment,
          nextQuestion: spokenQuestion ?? consult.nextQuestion,
          councilAgents: councilRound.echoes.map((e) => e.agent),
        });

        if (scenario.opening.expectDomain === 'generic') {
          expect(consult.acknowledgment).not.toMatch(/signalement générique/i);
        }
      });
    },
  );

  describe('tours locataire complémentaires', () => {
    it('poignée fenêtre — précision sans clôture prématurée', () => {
      const scenario = scenarios.find((s) => s.id === 'poignee_fenetre_alu')!;
      const housing = inferHousingPerspective(scenario.housingUnit);
      let sim = runJarvisSimulation({
        title: scenario.title,
        description: scenario.description,
        preferredLanguage: 'fr',
        housingKind: housing.kind,
      });
      sim = runJarvisSimulation({
        title: scenario.title,
        description: scenario.description,
        message: scenario.tenantTurn!.message,
        prior: sim,
        preferredLanguage: 'fr',
        housingKind: housing.kind,
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: scenario.title,
        description: scenario.description,
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
        message: scenario.tenantTurn!.message,
      });

      assertExpectations(scenario.tenantTurn!, {
        sim,
        acknowledgment: consult.acknowledgment,
        nextQuestion: consult.nextQuestion,
      });
    });
  });

  describe('périmètres — logement vs collectif', () => {
    it('lot 5F → perspective collective pour escalier / interphone', () => {
      const stair = scenarios.find((s) => s.id === 'marche_escalier_cassee')!;
      const housing = inferHousingPerspective(stair.housingUnit);
      expect(housing.kind).toBe('collective');
    });

    it('lot 26 → perspective standalone pour fenêtre alu', () => {
      const win = scenarios.find((s) => s.id === 'poignee_fenetre_alu')!;
      const housing = inferHousingPerspective(win.housingUnit);
      expect(housing.kind).toBe('standalone');
    });
  });

  describe('sondes Savoir — couverture entraînement', () => {
    it('la majorité des thèmes mécaniques ont une sonde dédiée (pas le fallback générique)', () => {
      const withProbe = scenarios.filter((s) =>
        s.opening.expectCouncilAgents?.includes('savoir'),
      );
      expect(withProbe.length).toBeGreaterThanOrEqual(8);
    });

    it('plus de 8 scénarios en allowsGenericFallbackQuestion', () => {
      const fallback = scenarios.filter((s) => s.opening.allowsGenericFallbackQuestion);
      expect(fallback.length).toBe(0);
    });
  });
});
