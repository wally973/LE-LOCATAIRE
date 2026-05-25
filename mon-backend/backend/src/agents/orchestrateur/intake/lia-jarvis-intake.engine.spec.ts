import {
  applyJarvis360ToState,
  isConfirmedTopicChange,
  isContestationOrReassurance,
  isJarvisReadyForImmediateVerdict,
  pickJarvisCriticalQuestion,
} from './lia-jarvis-intake.engine';
import { LiaIntakeService } from './lia-intake.service';
import { extractPlumbingIntakeFromText } from './lia-intake-plumbing-extract';

describe('lia-jarvis-intake.engine', () => {
  const intakeService = new LiaIntakeService();

  it('extrait fuite sous évier et nouveau locataire (Marie plomberie)', () => {
    const ex = extractPlumbingIntakeFromText(
      'Fuite sous évier',
      'Je viens d’emménager et l’évier fuit dessous',
    );
    expect(ex.underFixtureLeak).toBe(true);
    expect(ex.newTenant).toBe(true);
    expect(ex.jarvisFacts.nouveau_locataire).toBe('Oui');
    expect(ex.skippedQuestionIds).toContain('org:cause_colonne_collective');
  });

  it('ne confond pas citation toiture en protestation avec changement de sujet', () => {
    expect(
      isConfirmedTopicChange(
        'Pourquoi me parles-tu de toiture ? C’est l’évier qui fuit !',
        'Fuite sous évier',
        'Évier qui fuit dessous depuis emménagement',
        'PLUMBING',
      ),
    ).toBe(false);
    expect(
      isContestationOrReassurance(
        'Pourquoi me parles-tu de toiture ?',
      ),
    ).toBe(true);
  });

  it('sature l’intake plomberie évier et saute la question colonne', () => {
    let state = intakeService.createInitialState(
      'Fuite évier',
      'Je viens d’emménager, l’évier fuit dessous',
    );
    state = applyJarvis360ToState(state, state.intakeTitle!, state.intakeDescription!);
    expect(isJarvisReadyForImmediateVerdict(state)).toBe(true);
    const q = pickJarvisCriticalQuestion(state);
    if (q) {
      expect(q.causeId).not.toBe('cause_colonne_collective');
    }
  });
});
