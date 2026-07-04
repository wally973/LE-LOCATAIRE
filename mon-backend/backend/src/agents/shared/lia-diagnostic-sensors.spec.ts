import { buildDiagnosticState } from './lia-diagnostic-state';
import { loadPathologyIndex } from '../chercheur/research/knowledge-index.loader';
import {
  extractDiagnosticSensors,
  isWaterOnFloorReport,
} from './lia-diagnostic-sensors';
import {
  getIntakeQuestionsForState,
  usesWaterOnFloorPath,
  type LiaIntakeState,
} from '../orchestrateur/intake/lia-intake.service';

/** Texte Golden REF_EAU_SAVONNEUSE (docs/tests/REF_EAU_SAVONNEUSE.md). */
const REF_TEXT = `
Flaque d'eau au milieu du salon loin de la fenetre.
Logement au 1er etage R+1 residence Cayenne.
Saison seche aucune pluie depuis 3 semaines.
Climatisation en panne eteinte depuis 1 semaine.
Eau legerement savonneuse mousseuse uniquement entre 19h et 21h.
`.trim();

describe('REF_EAU_SAVONNEUSE — capteurs et diagnostic', () => {
  beforeAll(() => {
    loadPathologyIndex();
  });

  it('extrait les 4 capteurs sur le cas de référence', () => {
    const sensors = extractDiagnosticSensors({ contextText: REF_TEXT });
    expect(sensors.water_aspect).toMatch(/savon|mousse/);
    expect(sensors.timing_pattern).toMatch(/19/);
    expect(sensors.building_floor).toBe('R+1');
    expect(sensors.weather_context).toBe('Saison sèche');
    expect(sensors.symptom_anchor).toBe('sol');
  });

  it('extrait l’ancrage du symptôme sans photo', () => {
    const sensors = extractDiagnosticSensors({
      contextText: 'Infiltration dans la buanderie au plafond',
    });
    expect(sensors.symptom_anchor).toBe('plafond');
  });

  it('mène hyp_refoulement_eu en tête', () => {
    const state = buildDiagnosticState({
      category: 'HUMIDITY',
      contextText: REF_TEXT,
    });
    expect(state.leadingHypothesisId).toBe('hyp_refoulement_eu');
    expect(state.sensors?.water_aspect).toMatch(/savon|mousse/);
  });

  it('détecte eau au sol sans reposer les questions déjà résolues', () => {
    expect(isWaterOnFloorReport('Humidité', REF_TEXT)).toBe(true);
    const intake: LiaIntakeState = {
      phase: 'INTAKE',
      category: 'PLUMBING',
      stepIndex: 0,
      answers: {},
      intakeTitle: 'Eau au salon',
      intakeDescription: REF_TEXT,
    };
    expect(usesWaterOnFloorPath(intake)).toBe(true);
    const qs = getIntakeQuestionsForState(intake);
    expect(qs.map((q) => q.id)).not.toEqual(
      expect.arrayContaining(['water_aspect', 'timing_pattern']),
    );
  });
});
