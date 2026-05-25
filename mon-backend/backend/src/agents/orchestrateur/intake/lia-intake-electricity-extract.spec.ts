import { LiaIntakeService } from './lia-intake.service';
import {
  buildMarieElectricityAcknowledgment,
  extractElectricityIntakeFromText,
  isElectricityLightingIntakeSaturated,
} from './lia-intake-electricity-extract';

describe('Rigueur Marie — électricité éclairage', () => {
  const intake = new LiaIntakeService();

  const marieText =
    'Je viens d’emménager, la lumière de ma chambre ne marche pas. ' +
    'J’ai déjà changé l’ampoule et vérifié le compteur et le disjoncteur au tableau.';

  it('extrait ampoule, compteur et contexte nouveau locataire du premier message', () => {
    const ex = extractElectricityIntakeFromText(
      'Chambre sans lumière',
      marieText,
    );
    expect(ex.answers.bulb_action).toBeDefined();
    expect(ex.answers.room_breaker).toBeDefined();
    expect(ex.skippedQuestionIds).toContain('breaker');
    expect(ex.skippedQuestionIds).toContain('subscription');
    expect(ex.newTenant).toBe(true);
    expect(ex.roomHint).toMatch(/chambre/i);
  });

  it('intake initial : questions générales sautées, phase DONE sans photo chambre', () => {
    const state = intake.createInitialState('Chambre sans lumière', marieText);
    expect(state.category).toBe('ELECTRICITY');
    expect(state.answers.bulb_action).toBeDefined();
    expect(state.skippedQuestionIds).toEqual(
      expect.arrayContaining(['breaker', 'breaker_stays', 'subscription']),
    );
    expect(isElectricityLightingIntakeSaturated(state)).toBe(true);
    expect(state.phase).toBe('DONE');
    expect(intake.needsPhoto(state)).toBe(false);
  });

  it('accusé de réception Marie : compteur, ampoule, emménagement', () => {
    const ex = extractElectricityIntakeFromText('Chambre', marieText);
    const ack = buildMarieElectricityAcknowledgment({
      title: 'Chambre',
      description: marieText,
      answers: ex.answers,
      tenantFirstName: 'Marie',
    });
    expect(ack).toMatch(/Marie/i);
    expect(ack).toMatch(/compteur|disjoncteur/i);
    expect(ack).toMatch(/ampoule/i);
    expect(ack).toMatch(/emménager/i);
  });
});
