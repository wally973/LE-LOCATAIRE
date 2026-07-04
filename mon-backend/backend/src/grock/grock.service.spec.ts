import { parseGrockStructuredReply } from './grock.service';

describe('parseGrockStructuredReply', () => {
  it('accepte et conserve note_interne en JSON strict', () => {
    const parsed = parseGrockStructuredReply(
      JSON.stringify({
        thinking: 'Analyse cognitive interne.',
        state: 'ASK_ONE_QUESTION',
        next_action: 'Demander le lieu exact.',
        acknowledgment: 'Où voyez-vous la trace exactement ?',
        note_interne: 'Croiser infiltration, tiers et assurance.',
      }),
    );

    expect(parsed.thinking).toBe('Analyse cognitive interne.');
    expect(parsed.state).toBe('ASK_ONE_QUESTION');
    expect(parsed.next_action).toBe('Demander le lieu exact.');
    expect(parsed.acknowledgment).toBe('Où voyez-vous la trace exactement ?');
    expect(parsed.note_interne).toBe('Croiser infiltration, tiers et assurance.');
  });

  it('préserve note_interne extraite en mode loose', () => {
    const parsed = parseGrockStructuredReply(`
      thinking: brouillon
      "state": "WAITING_TENANT",
      "next_action": "attendre",
      "acknowledgment": "Je prends en compte votre précision.",
      "note_interne": "Ne pas écraser la piste tiers."
    `);

    expect(parsed.acknowledgment).toBe('Je prends en compte votre précision.');
    expect(parsed.note_interne).toBe('Ne pas écraser la piste tiers.');
  });

  it('ne remplace pas un acknowledgment valide par un fallback durci', () => {
    const parsed = parseGrockStructuredReply(
      JSON.stringify({
        thinking: 'Deux questions possibles, mais Marie reçoit la parole du modèle.',
        state: 'ASK_ONE_QUESTION',
        next_action: 'question libre',
        acknowledgment: 'La trace est au plafond ou sur le mur ? Depuis quand ?',
        note_interne: 'Le validateur ne coupe plus la parole.',
      }),
    );

    expect(parsed.acknowledgment).toBe(
      'La trace est au plafond ou sur le mur ? Depuis quand ?',
    );
    expect(parsed.note_interne).toBe('Le validateur ne coupe plus la parole.');
  });
});
