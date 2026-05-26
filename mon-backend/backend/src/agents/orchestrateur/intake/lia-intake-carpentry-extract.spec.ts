import {
  extractCarpentryIntakeFromText,
  isCarpentryDoorIssueSaturated,
  isCarpentryDoorIssueText,
} from './lia-intake-carpentry-extract';
import { LiaIntakeService } from './lia-intake.service';

describe('lia-intake-carpentry-extract', () => {
  const marie =
    'bonjour, je vous signale que la gâche de la porte de la chambre de mon fils est cassée';

  it('détecte une panne gâche / porte', () => {
    expect(isCarpentryDoorIssueText(marie)).toBe(true);
  });

  it('extrait lieu et élément sans questionnaire scripté (llm_first)', () => {
    const ex = extractCarpentryIntakeFromText(marie, marie);
    expect(ex.skippedQuestionIds).toContain('location_detail');
    expect(ex.skippedQuestionIds).toContain('worsening');
    expect(ex.jarvisFacts.element).toMatch(/Gâche/i);
    expect(ex.jarvisFacts.localisation).toMatch(/chambre/i);

    const intake = new LiaIntakeService();
    const state = intake.createInitialState(marie, marie);
    expect(state.intakeMode).toBe('llm_first');
    expect(intake.getCurrentQuestion(state)).toBeNull();
    expect(isCarpentryDoorIssueSaturated(state)).toBe(true);
  });
});
