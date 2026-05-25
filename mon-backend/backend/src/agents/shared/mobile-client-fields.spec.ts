import {
  assertMobileFieldTypes,
  extractMobileFields,
} from './mobile-client-fields';

describe('mobile-client-fields (contrat JSON Flutter)', () => {
  it('extrait language, severity, sensors, legal_basis, avatar_action', () => {
    const ticket = {
      aiSeverity: 'HIGH',
      aiLastDecision: {
        severity: 'HIGH',
        legal_basis: 'Base légale retenue : article 1719 du Code civil.',
        companion: {
          language: 'gcf',
          avatar_action: 'GESTURE:nod',
          lastSpeech: 'Bonjou Marie',
        },
        diagnostic: {
          sensors: {
            water_aspect: 'savonneuse/mousseuse',
            building_floor: 'R+1',
            weather_context: 'Saison sèche',
            timing_pattern: '19h-21h',
          },
        },
      },
    };

    const fields = extractMobileFields(ticket);
    expect(fields.language).toBe('gcf');
    expect(fields.severity).toBe('HIGH');
    expect(fields.avatar_action).toBe('GESTURE:nod');
    expect(fields.legal_basis).toContain('1719');
    expect(fields.sensors?.building_floor).toBe('R+1');
    expect(() => assertMobileFieldTypes('test', fields, { requireAll: true })).not.toThrow();
  });

  it('fusionne capteurs diagnostic + réponses intake', () => {
    const ticket = {
      aiSeverity: 'HIGH',
      aiLastDecision: {
        companion: { language: 'gcf', avatar_action: 'GESTURE:nod', lastSpeech: 'ok' },
        diagnostic: { sensors: { timing_pattern: '19h-21h' } },
        intake: {
          answers: {
            water_aspect: 'Eau savonneuse et mousseuse',
            building_floor: 'R+1, premier étage',
            weather_context: 'Saison sèche',
          },
        },
      },
    };
    const fields = extractMobileFields(ticket);
    expect(fields.sensors?.water_aspect).toContain('savonneuse');
    expect(fields.sensors?.building_floor).toBe('R+1, premier étage');
    expect(fields.sensors?.weather_context).toBe('Saison sèche');
  });

  it('ignore les capteurs non-string (évite erreur typage Flutter)', () => {
    const ticket = {
      aiSeverity: 'MEDIUM',
      aiLastDecision: {
        legal_basis: 'ok',
        companion: { language: 'fr', avatar_action: 'GESTURE:wave' },
        diagnostic: { sensors: { building_floor: 42 } },
      },
    };
    const fields = extractMobileFields(ticket);
    expect(fields.sensors).toBeNull();
  });
});
