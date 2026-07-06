import { buildSignalementBlock } from './signalement-builder';
import { normalizeSignalText } from './text-normalizer';

describe('Couche 0 — préprocesseur', () => {
  it('normalise unicode et espaces sans altérer le sens', () => {
    expect(normalizeSignalText('  fuite   chauffe\r\neau  ')).toBe('fuite chauffe\neau');
  });

  it('contextualise le signalement selon le rôle locataire', () => {
    const block = buildSignalementBlock({
      interlocutor: 'tenant',
      tenantFirstName: 'Marie',
      title: 'Fuite ECS',
      description: 'Vanne fermée.',
    });
    expect(block).toContain('locataire (mobile)');
    expect(block).toContain('Locataire : Marie');
    expect(block).toContain('Fuite ECS');
  });

  it('contextualise le signalement pour le bailleur', () => {
    const block = buildSignalementBlock({
      interlocutor: 'landlord',
      tenantFirstName: '',
      title: 'Sinistre collectif',
      description: 'Infiltration toiture.',
    });
    expect(block).toContain('bailleur (patrimoine)');
    expect(block).toContain('Sinistre collectif');
  });
});
