import {
  applyJarvis360ToState,
  isConfirmedTopicChange,
  isContestationOrReassurance,
} from './lia-jarvis-intake.engine';
import { LiaIntakeService } from './lia-intake.service';
import { extractPlumbingIntakeFromText } from './lia-intake-plumbing-extract';
import {
  buildJarvisConsultation,
  runJarvisSimulation,
} from './lia-jarvis-simulation.engine';

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

  it('simulation porte — visualise affaissement et question cadre/sol', () => {
    const sim = runJarvisSimulation({
      title: 'Porte ne ferme plus',
      description: 'Ma porte ne ferme plus, la serrure accroche.',
    });
    const consult = buildJarvisConsultation({
      simulation: sim,
      title: 'Porte ne ferme plus',
      description: 'Ma porte ne ferme plus, la serrure accroche.',
      tenantFirstName: 'Marie',
      mode: 'opening',
    });
    expect(consult.acknowledgment).not.toMatch(/je visualise|en visualisant|mwen vizualiz/i);
    expect(consult.acknowledgment).toMatch(/porte|pòt/i);
    expect(consult.visualizationNote).toMatch(/visualis|affais|gond|accroch/i);
    expect(consult.nextQuestion).toMatch(/clé|clef|tourne|ferme|key/i);
    expect(consult.nextQuestion).not.toMatch(/pleut/i);
  });

  it('simulation évier — question timing avant pluie', () => {
    let state = intakeService.createInitialState(
      'Fuite évier',
      'Fuite sous l’évier depuis emménagement',
    );
    state = applyJarvis360ToState(state, state.intakeTitle!, state.intakeDescription!);
    const sim = runJarvisSimulation({
      title: state.intakeTitle!,
      description: state.intakeDescription!,
    });
    const consult = buildJarvisConsultation({
      simulation: sim,
      title: state.intakeTitle!,
      description: state.intakeDescription!,
      tenantFirstName: 'Marie',
      mode: 'opening',
    });
    expect(consult.nextQuestion).toMatch(/moment|ouvrez|vidé/i);
    expect(consult.nextQuestion).not.toMatch(/pleut/i);
    expect(sim.intakeComplete).toBe(false);
  });
});
