import {
  buildMissingCriticalSensorsMessage,
  getMissingCriticalSensors,
} from './critical-diagnostic-sensors';

describe('critical-diagnostic-sensors', () => {
  it('exige aspect, horaire et étage pour eau au sol', () => {
    const missing = getMissingCriticalSensors({
      title: 'Eau au sol',
      description: 'flaque milieu du salon',
      sensors: {},
    });
    expect(missing).toEqual(
      expect.arrayContaining(['water_aspect', 'timing_pattern', 'building_floor']),
    );
    expect(buildMissingCriticalSensorsMessage(missing)).toMatch(/aspect de l’eau/i);
  });

  it('ne bloque pas si les 3 capteurs sont présents', () => {
    const missing = getMissingCriticalSensors({
      title: 'Eau au sol',
      description: 'nappe',
      sensors: {
        water_aspect: 'savonneuse',
        timing_pattern: '19h-21h',
        building_floor: 'R+1',
        symptom_anchor: 'sol',
      },
    });
    expect(missing).toHaveLength(0);
  });

  it('demande l’ancrage du symptôme pour une infiltration vague sans photo', () => {
    const missing = getMissingCriticalSensors({
      title: 'Toiture / infiltration',
      description: 'infiltration dans la buanderie',
      sensors: {},
    });

    expect(missing).toEqual(['symptom_anchor']);
    expect(buildMissingCriticalSensorsMessage(missing)).toMatch(/plafond, mur, sol/i);
  });

  it('ne bloque pas une infiltration déjà localisée', () => {
    const missing = getMissingCriticalSensors({
      title: 'Toiture / infiltration',
      description: 'infiltration dans la buanderie au plafond',
      sensors: { symptom_anchor: 'plafond' },
    });

    expect(missing).toHaveLength(0);
  });
});
