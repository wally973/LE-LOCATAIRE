import { analyzeCapteurParoleAlignment } from './grock-capteur-parole-probe';

describe('analyzeCapteurParoleAlignment', () => {
  it('détecte sinistre en capteurs absent de la parole (technicien seul)', () => {
    const r = analyzeCapteurParoleAlignment({
      noteInterne: 'Sinistre probable, déclaration assurance 5 jours, origine voisin dessus.',
      state: 'bailleur_responsable',
      tenantMessage: 'Eau au plafond, voisin du dessus.',
      acknowledgment:
        'Merci pour votre signalement. Nous allons envoyer un technicien pour vérifier la fuite.',
    });
    expect(r.missingInSpeech).toContain('assurance_sinistre');
    expect(r.stateSpeechGap).toMatch(/sinistre|assurance/i);
  });

  it('valide obscurité reflétée quand le locataire parle de noir', () => {
    const r = analyzeCapteurParoleAlignment({
      thinking: 'Le locataire signale obscurité avant la photo.',
      state: 'NEED_PHOTO',
      tenantMessage: 'Il fait trop noir, je vais allumer la lumière.',
      acknowledgment:
        'Oui, allumez la lumière prudemment pour que la photo soit lisible, puis envoyez-la.',
    });
    expect(r.missingInSpeech).not.toContain('obscurite_lumiere');
    expect(r.coveragePct).toBeGreaterThan(0);
  });
});
