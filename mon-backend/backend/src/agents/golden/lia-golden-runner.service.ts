import { Injectable } from '@nestjs/common';
import { LiaIntakeService } from '../orchestrateur/intake/lia-intake.service';
import { LiaLlmFirstComprehensionService } from '../comprehension/lia-llm-first-comprehension.service';
import { LiaIntakeReactiveService } from '../orchestrateur/intake/lia-intake-reactive.service';
import { loadGoldenScenarios } from './lia-golden-scenarios.loader';
import {
  evaluateOpeningStep,
  evaluateTurnStep,
} from './lia-golden-evaluator';
import type {
  GoldenDialogueStep,
  GoldenScenario,
  GoldenScenarioResult,
} from './lia-golden-scenarios.types';

function stepFromTurn(
  acknowledgment: string | null,
  nextQuestion: string | null,
  phase: string,
  lang?: string,
): GoldenDialogueStep {
  const parts = [acknowledgment, nextQuestion].filter(Boolean) as string[];
  return {
    acknowledgment,
    nextQuestion,
    combinedHostText: parts.join('\n'),
    intakePhase: phase,
    preferredLanguage: lang,
  };
}

@Injectable()
export class LiaGoldenRunnerService {
  constructor(
    private readonly intake: LiaIntakeService,
    private readonly llmFirst: LiaLlmFirstComprehensionService,
    private readonly reactive: LiaIntakeReactiveService,
  ) {}

  /** Exécute tous les scénarios or (nécessite GROQ_API_KEY si live). */
  async runAll(opts?: { live?: boolean }): Promise<GoldenScenarioResult[]> {
    const live = opts?.live ?? Boolean(process.env.GROQ_API_KEY);
    const file = loadGoldenScenarios();
    const results: GoldenScenarioResult[] = [];

    for (const scenario of file.scenarios) {
      results.push(await this.runScenario(scenario, live));
    }
    return results;
  }

  async runScenario(
    scenario: GoldenScenario,
    live: boolean,
  ): Promise<GoldenScenarioResult> {
    const issues: GoldenScenarioResult['issues'] = [];
    const steps: GoldenDialogueStep[] = [];

    if (!live) {
      return {
        id: scenario.id,
        label: scenario.label,
        passed: true,
        skippedLive: true,
        issues: [],
        steps: [],
      };
    }

    let state = this.intake.createInitialState(
      scenario.title,
      scenario.description,
    );
    state = { ...state, intakeMode: 'llm_first' };

    const opening = await this.llmFirst.comprehendOpening({
      state,
      title: scenario.title,
      description: scenario.description,
      tenantFirstName: scenario.tenantFirstName,
    });
    state = opening.state;
    const openStep = stepFromTurn(
      opening.acknowledgment,
      opening.nextQuestion,
      state.phase,
      state.preferredLanguage,
    );
    steps.push(openStep);
    issues.push(...evaluateOpeningStep(scenario, openStep));

    for (let i = 0; i < scenario.turns.length; i++) {
      const turn = scenario.turns[i];
      const reactive = await this.reactive.processTenantReply({
        state,
        message: turn.tenant,
        title: scenario.title,
        description: scenario.description,
        tenantFirstName: scenario.tenantFirstName,
      });
      state = reactive.state;
      const turnStep = stepFromTurn(
        reactive.acknowledgment,
        reactive.nextQuestionText,
        state.phase,
        state.preferredLanguage,
      );
      steps.push(turnStep);
      issues.push(...evaluateTurnStep(scenario, i, turnStep));
    }

    return {
      id: scenario.id,
      label: scenario.label,
      passed: issues.length === 0,
      issues,
      steps,
    };
  }
}
