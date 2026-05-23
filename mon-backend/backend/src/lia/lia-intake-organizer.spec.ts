import { LiaIntakeService } from './lia-intake.service';
import { isOrganizerQuestionId } from './lia-intake-organizer';

describe('LiaIntakeService + organisateur JSON', () => {
  const intake = new LiaIntakeService();

  it('ouvre un parcours organisateur pour éclairage SDB', () => {
    const state = intake.createInitialState(
      'Lumière SDB',
      'La lumière de la salle de bain ne marche plus, ampoule déjà changée',
    );
    expect(state.organizer?.panneId).toBe('PANNE_ECLAIRAGE_LOCALISE');
    expect(state.organizer?.eliminatedCauseIds).toContain('cause_ampoule_usee');

    const q = intake.getCurrentQuestion(state);
    expect(q).toBeTruthy();
    expect(isOrganizerQuestionId(q!.id)).toBe(true);
    expect(q!.text).toMatch(/disjoncteur/i);
  });

  it('enchaîne les questions discriminantes du JSON', () => {
    let state = intake.createInitialState(
      'Lumière cuisine',
      'Plus de lumière dans la cuisine',
    );
    const q1 = intake.getCurrentQuestion(state);
    expect(q1?.id).toMatch(/^org:/);

    state = intake.recordAnswer(state, 'Non, le disjoncteur est déclenché');
    const q2 = intake.getCurrentQuestion(state);
    expect(q2).toBeTruthy();
    expect(q2!.id).not.toBe(q1!.id);
  });

  it('retombe sur questions fixes si pas d’arbre (GENERIC vague)', () => {
    const state = intake.createInitialState('Souci', 'Il y a un souci');
    expect(state.organizer).toBeUndefined();
    const q = intake.getCurrentQuestion(state);
    expect(q?.id).toBe('since_when');
  });
});
