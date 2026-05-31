import { inferHousingPerspective } from './lia-housing-perspective';
import { pickCouncilSpokenQuestion, runCouncilRound } from './lia-jarvis-council.engine';
import {
  assertTextPatterns,
  loadJarvisJuridiqueTrainingScenarios,
  type JuridiqueTrainingScenario,
  type TrainingScenarioExpect,
} from './lia-jarvis-training-scenarios.loader';
import {
  buildJarvisConsultation,
  runJarvisSimulation,
} from './lia-jarvis-simulation.engine';
import { synthesizeJarvisFromCouncil } from './lia-jarvis-voice-synthesis';
import { pickChainQuestion } from './lia-jarvis-visual-chain';
import type { LiaIntakeState } from './lia-intake.service';

const emptyState = {} as LiaIntakeState;

function runJuridiqueOpening(scenario: JuridiqueTrainingScenario) {
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
  const juriste = councilRound.echoes.find((e) => e.agent === 'juriste');
  return { sim, consult, councilRound, spokenQuestion, juriste, housing };
}

function runJuridiqueTenantTurn(scenario: JuridiqueTrainingScenario) {
  const { sim: openingSim, housing } = runJuridiqueOpening(scenario);
  const message = scenario.tenantTurn!.message;
  const sim = runJarvisSimulation({
    title: scenario.title,
    description: scenario.description,
    message,
    prior: openingSim,
    preferredLanguage: 'fr',
    housingKind: housing.kind,
  });
  const councilRound = runCouncilRound({
    title: scenario.title,
    description: scenario.description,
    message,
    state: emptyState,
    simulation: sim,
    housing,
    chainQuestion: pickChainQuestion(sim, 'fr'),
  });
  const consult = buildJarvisConsultation({
    simulation: sim,
    title: scenario.title,
    description: scenario.description,
    tenantFirstName: 'Marie',
    mode: 'tenant_turn',
    message,
  });
  const fallbackQuestion = pickCouncilSpokenQuestion(
    consult.nextQuestion,
    councilRound,
    sim.resolvedSteps,
  );
  const voice = synthesizeJarvisFromCouncil({
    name: 'Marie',
    lang: sim.language,
    message,
    title: scenario.title,
    description: scenario.description,
    housingKind: housing.kind,
    simulation: sim,
    councilRound,
    fallbackQuestion,
  });
  const juriste = councilRound.echoes.find((e) => e.agent === 'juriste');
  return {
    sim,
    acknowledgment: voice.acknowledgment,
    nextQuestion: voice.nextQuestion,
    juriste,
    councilRound,
  };
}

function assertJuridiqueExpectations(
  rules: TrainingScenarioExpect & { juristeInsightMustMatch?: string[] },
  params: {
    sim: ReturnType<typeof runJarvisSimulation>;
    acknowledgment: string;
    nextQuestion: string | null;
    juriste?: { insight: string };
    councilAgents?: string[];
  },
) {
  if (rules.expectIntakeComplete != null) {
    expect(params.sim.intakeComplete).toBe(rules.expectIntakeComplete);
  }
  if (rules.juristeInsightMustMatch?.length) {
    expect(params.juriste).toBeDefined();
    assertTextPatterns(
      params.juriste!.insight,
      rules.juristeInsightMustMatch,
      'mustMatch',
    );
  }
  if (rules.expectCouncilAgents?.length) {
    for (const agent of rules.expectCouncilAgents) {
      expect(params.councilAgents).toContain(agent);
    }
  }
  assertTextPatterns(params.acknowledgment, rules.ackMustNotMatch, 'mustNotMatch');
  assertTextPatterns(params.nextQuestion, rules.questionMustMatch, 'mustMatch');
  assertTextPatterns(params.nextQuestion, rules.questionMustNotMatch, 'mustNotMatch');
  expect(params.acknowledgment).not.toMatch(/87-712|art\. 1719|décret n/i);
}

describe('lia-jarvis-training-juridique — charge et procédure', () => {
  const scenarios = loadJarvisJuridiqueTrainingScenarios();

  it('catalogue — 10 thèmes juridiques avec tour locataire', () => {
    expect(scenarios.length).toBe(10);
    expect(scenarios.every((s) => s.tenantTurn?.message.trim())).toBe(true);
  });

  describe.each(scenarios.map((s) => [s.id, s] as const))(
    'ouverture juridique [%s]',
    (_id, scenario) => {
      it(`« ${scenario.theme} » — juriste en console, Jarvis sans article de loi`, () => {
        const { consult, councilRound, spokenQuestion, juriste } =
          runJuridiqueOpening(scenario);

        expect(juriste).toBeDefined();
        assertTextPatterns(
          juriste!.insight,
          scenario.opening.juristeInsightMustMatch,
          'mustMatch',
        );

        for (const agent of scenario.opening.expectCouncilAgents ?? []) {
          expect(councilRound.echoes.map((e) => e.agent)).toContain(agent);
        }

        assertTextPatterns(consult.acknowledgment, scenario.opening.ackMustNotMatch, 'mustNotMatch');
        assertTextPatterns(
          spokenQuestion ?? consult.nextQuestion,
          scenario.opening.questionMustMatch,
          'mustMatch',
        );
        assertTextPatterns(
          spokenQuestion ?? consult.nextQuestion,
          scenario.opening.questionMustNotMatch,
          'mustNotMatch',
        );

        expect(juriste!.insight).not.toMatch(/^Marie,/);
        expect(consult.acknowledgment).not.toMatch(/87-712|art\. 1719|décret n/i);
      });
    },
  );

  describe.each(
    scenarios
      .filter((s) => s.tenantTurn)
      .map((s) => [s.id, s] as const),
  )('tour locataire juridique [%s]', (_id, scenario) => {
    it(`« ${scenario.theme} » — faits intégrés, pas de re-sonde ni de loi au locataire`, () => {
      const { sim, acknowledgment, nextQuestion, juriste, councilRound } =
        runJuridiqueTenantTurn(scenario);

      assertJuridiqueExpectations(scenario.tenantTurn!, {
        sim,
        acknowledgment,
        nextQuestion,
        juriste,
        councilAgents: councilRound.echoes.map((e) => e.agent),
      });

      expect(juriste!.insight).not.toMatch(/^Marie,/);
    });
  });
});
