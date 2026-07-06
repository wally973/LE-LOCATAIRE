import {
  isDegenerateAcknowledgment,
  resolveVisibleSpeech,
  stripInternalJargon,
} from './grock-parole-guard';

describe('grock-parole-guard (confiance Mistral)', () => {
  it('conserve la parole du modèle quand elle est une vraie phrase', () => {
    const speech = resolveVisibleSpeech({
      acknowledgment:
        'Oui, si la buanderie est sombre, allumez la lumière prudemment avant de prendre la photo.',
      nextAction: 'Attendre photo buanderie.',
      state: 'NEED_PHOTO',
    });
    expect(speech).toContain('allumez la lumière');
  });

  it('ne remplace pas par un template technicien sur state bailleur', () => {
    const speech = resolveVisibleSpeech({
      acknowledgment:
        'Avant d’envoyer le technicien : sécurisez, déclarez le sinistre à l’assurance sous 5 jours, puis photo du plafond.',
      nextAction: 'Brief technicien infiltration.',
      state: 'bailleur_responsable',
    });
    expect(speech).toContain('assurance');
    expect(speech).not.toBe(
      'C’est à la charge du bailleur : je transmets un ticket au technicien du secteur, il vous contactera.',
    );
  });

  it('utilise next_action si acknowledgment est un mot nu', () => {
    const speech = resolveVisibleSpeech({
      acknowledgment: 'technicien',
      nextAction: 'Pouvez-vous m’envoyer une photo du plafond humide ?',
      state: 'NEED_PHOTO',
    });
    expect(speech).toContain('photo');
  });

  it('stripInternalJargon masque les codes internes', () => {
    expect(stripInternalJargon('Dossier QV0373 en cours.')).not.toContain('QV0373');
  });

  it('isDegenerateAcknowledgment rejette un mot seul', () => {
    expect(isDegenerateAcknowledgment('technicien')).toBe(true);
    expect(isDegenerateAcknowledgment('Où est la fuite exactement ?')).toBe(false);
  });
});
