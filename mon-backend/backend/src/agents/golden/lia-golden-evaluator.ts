import type {
  GoldenDialogueStep,
  GoldenEvaluationIssue,
  GoldenScenario,
  GoldenScenarioExpectations,
  GoldenTurnExpect,
} from './lia-golden-scenarios.types';

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function checkMustNotContain(
  text: string,
  forbidden: string[] | undefined,
  issues: GoldenEvaluationIssue[],
  scenarioId: string,
  step: string,
): void {
  if (!forbidden?.length) return;
  const n = norm(text);
  for (const phrase of forbidden) {
    if (n.includes(norm(phrase))) {
      issues.push({
        scenarioId,
        step,
        rule: 'mustNotContain',
        detail: `Phrase interdite trouvée : « ${phrase} »`,
      });
    }
  }
}

function checkMustMentionAny(
  text: string,
  required: string[] | undefined,
  issues: GoldenEvaluationIssue[],
  scenarioId: string,
  step: string,
): void {
  if (!required?.length) return;
  const n = norm(text);
  const ok = required.some((w) => n.includes(norm(w)));
  if (!ok) {
    issues.push({
      scenarioId,
      step,
      rule: 'mustMentionAny',
      detail: `Attendu au moins un de : ${required.join(', ')}`,
    });
  }
}

function applyExpectBlock(
  text: string,
  expect: GoldenTurnExpect | GoldenScenarioExpectations | undefined,
  issues: GoldenEvaluationIssue[],
  scenarioId: string,
  step: string,
): void {
  if (!expect) return;
  checkMustNotContain(text, expect.mustNotContain, issues, scenarioId, step);
  checkMustMentionAny(text, expect.mustMentionAny, issues, scenarioId, step);
  if (expect.mustContain?.length) {
    for (const phrase of expect.mustContain) {
      if (!norm(text).includes(norm(phrase))) {
        issues.push({
          scenarioId,
          step,
          rule: 'mustContain',
          detail: `Manque : « ${phrase} »`,
        });
      }
    }
  }
  if (expect.maxHostQuestions != null) {
    const q = countQuestions(text);
    if (q > expect.maxHostQuestions) {
      issues.push({
        scenarioId,
        step,
        rule: 'maxHostQuestions',
        detail: `${q} question(s) ?, max ${expect.maxHostQuestions}`,
      });
    }
  }
}

export function evaluateOpeningStep(
  scenario: GoldenScenario,
  step: GoldenDialogueStep,
): GoldenEvaluationIssue[] {
  const issues: GoldenEvaluationIssue[] = [];
  const exp = scenario.expectations;
  const host = step.combinedHostText;

  applyExpectBlock(host, exp, issues, scenario.id, 'opening');

  if (exp.language && step.preferredLanguage && step.preferredLanguage !== exp.language) {
    issues.push({
      scenarioId: scenario.id,
      step: 'opening',
      rule: 'language',
      detail: `Langue ${step.preferredLanguage}, attendu ${exp.language}`,
    });
  }

  if (exp.intakeCompleteOnOpening && step.intakePhase !== 'DONE') {
    issues.push({
      scenarioId: scenario.id,
      step: 'opening',
      rule: 'intakeCompleteOnOpening',
      detail: `Phase ${step.intakePhase}, attendu DONE`,
    });
  }

  if (exp.allowsPhotoRequest === false && /photo plus nette|pas totalement sûrs/i.test(host)) {
    issues.push({
      scenarioId: scenario.id,
      step: 'opening',
      rule: 'allowsPhotoRequest',
      detail: 'Demande de photo non attendue à l’ouverture',
    });
  }

  if (exp.maxHostQuestions != null) {
    const q = countQuestions(host);
    if (q > exp.maxHostQuestions) {
      issues.push({
        scenarioId: scenario.id,
        step: 'opening',
        rule: 'maxHostQuestions',
        detail: `${q} question(s) à l’ouverture, max ${exp.maxHostQuestions}`,
      });
    }
  }

  return issues;
}

export function evaluateTurnStep(
  scenario: GoldenScenario,
  turnIndex: number,
  step: GoldenDialogueStep,
): GoldenEvaluationIssue[] {
  const issues: GoldenEvaluationIssue[] = [];
  const turn = scenario.turns[turnIndex];
  if (!turn) return issues;
  applyExpectBlock(
    step.combinedHostText,
    turn.expect,
    issues,
    scenario.id,
    `turn-${turnIndex + 1}`,
  );
  return issues;
}
