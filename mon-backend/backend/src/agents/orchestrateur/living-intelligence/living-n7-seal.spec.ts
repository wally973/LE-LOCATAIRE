import { enforceAnchoringGate, isPaulAnchoringConfirmed } from './living-anchoring-gate';
import {
  findSemanticViolations,
  resolveSemanticSubject,
  sanitizeExpertReport,
  scrubSemanticViolations,
} from './living-semantic-veto';
import {
  physicallyRecreateJarvisFacts,
  newStateInstanceId,
} from './living-state-instance';
import { createLivingBuildingState } from './living-building-state.factory';
import { forgePristineLivingState } from './living-tabula-rasa';

describe('Niveau 7 — étanchéité cerveau', () => {
  it('physicallyRecreateJarvisFacts — ne propage pas les fantômes cognitifs', () => {
    const state = forgePristineLivingState({
      title: 'Carrelage',
      description: 'carreaux levés',
      language: 'fr',
    });
    const out = physicallyRecreateJarvisFacts(
      {
        objet_ancre: 'porte',
        perception_metier: 'menuiserie',
        trade_override: 'Toiture',
        langue_choisie: 'oui',
        housing_unit: '5F',
      },
      state,
    );
    expect(out.objet_ancre).toBeUndefined();
    expect(out.perception_metier).toBeUndefined();
    expect(out.trade_override).toBeUndefined();
    expect(out.langue_choisie).toBe('oui');
    expect(out.housing_unit).toBe('5F');
    expect(out.living_state_instance_id).toBeTruthy();
    expect(out.living_building_state_v1).toContain('Carrelage');
  });

  it('forgePristineLivingState — stateInstanceId unique à chaque appel', () => {
    const a = forgePristineLivingState({
      title: 'Carrelage',
      description: 'test',
      language: 'fr',
    });
    const b = forgePristineLivingState({
      title: 'Carrelage',
      description: 'test',
      language: 'fr',
    });
    expect(a.stateInstanceId).toBeTruthy();
    expect(b.stateInstanceId).toBeTruthy();
    expect(a.stateInstanceId).not.toBe(b.stateInstanceId);
  });

  it('veto sémantique carrelage — interdit menuiserie, toiture, clés, porte', () => {
    const subject = resolveSemanticSubject('Carrelage qui se soulève dans la chambre');
    expect(subject).toBe('carrelage');
    const violations = findSemanticViolations(
      'Paul voit une porte et une toiture avec menuiserie',
      subject,
    );
    expect(violations.length).toBeGreaterThanOrEqual(3);
    const scrubbed = scrubSemanticViolations(
      'Problème de porte et toiture',
      subject,
    );
    expect(scrubbed).not.toMatch(/\bporte\b/i);
    expect(scrubbed).toContain('[hors-sujet-veto]');
  });

  it('sanitizeExpertReport — purge insight Paul hors-sujet', () => {
    const cleaned = sanitizeExpertReport(
      { insight: 'Fuite par la porte — toiture suspecte', tradeNeeded: 'Menuiserie' },
      'carrelage',
    );
    expect(String(cleaned?.insight)).not.toMatch(/\bporte\b/i);
    expect(String(cleaned?.tradeNeeded)).not.toMatch(/menuiserie/i);
  });

  it('ancrage Paul — bloque « je vous guide » si modèle non aligné', () => {
    const ok = isPaulAnchoringConfirmed({
      subject: 'carrelage',
      signalementScope: 'Carrelage chambre carreaux levés',
      enqueteur: { insight: 'porte qui ferme mal', ancrageConfirme: false },
      vision3d: createLivingBuildingState({
        title: 'Carrelage',
        description: 'x',
        language: 'fr',
      }).vision3d,
    });
    expect(ok).toBe(false);

    const parole = enforceAnchoringGate({
      parole: 'Marie, je vous guide pour la suite.',
      anchoringConfirmed: false,
      displayName: 'Marie',
      subject: 'carrelage',
    });
    expect(parole).not.toMatch(/je vous guide/i);
    expect(parole).toMatch(/même élément/i);
  });

  it('ancrage Paul — accepte Pression Dalle sur dossier carrelage', () => {
    const ok = isPaulAnchoringConfirmed({
      subject: 'carrelage',
      signalementScope: 'Carrelage qui se soulève',
      enqueteur: {
        ancrageConfirme: true,
        modeleMental: 'Pression dalle / décollement carrelage',
      },
      vision3d: createLivingBuildingState({
        title: 'Carrelage',
        description: 'x',
        language: 'fr',
      }).vision3d,
    });
    expect(ok).toBe(true);
  });

  it('newStateInstanceId — UUID distincts', () => {
    expect(newStateInstanceId()).not.toBe(newStateInstanceId());
  });
});
