import {
  createLivingBuildingState,
  parseLivingBuildingState,
} from './living-building-state.factory';
import {
  applyLivingSafetyVerification,
  inferInitialSeverityFromSignalement,
  isLivingSafetyLockActive,
} from './living-building-state.safety';
import {
  forgePristineLivingState,
  nuclearFlushLivingState,
  nuclearFlushJarvisFacts,
  purgeJarvisCognitiveFacts,
} from './living-tabula-rasa';
import { LIVING_STATE_JARVIS_KEY, writeLivingStateToIntake } from './living-building-state.repository';
import { isLivingIntelligenceEnabled } from './living-intelligence.config';

describe('living-intelligence — LIVING_BUILDING_STATE', () => {
  it('isLivingIntelligenceEnabled — false sans clé LLM (Mistral/Groq)', () => {
    // Depuis la migration Grock, le cœur s'active avec Mistral OU Groq :
    // on doit retirer les deux clés pour vérifier l'état désactivé.
    const prevGroq = process.env.GROQ_API_KEY;
    const prevMistral = process.env.MISTRAL_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    expect(isLivingIntelligenceEnabled()).toBe(false);
    if (prevGroq) process.env.GROQ_API_KEY = prevGroq;
    if (prevMistral) process.env.MISTRAL_API_KEY = prevMistral;
  });

  it('factory Tabula Rasa — DAWN neutre (pas de pré-classification)', () => {
    const state = createLivingBuildingState({
      title: 'Électricité',
      description: 'prises arrachées grésillement',
      language: 'fr',
    });
    expect(state.safetyLock.severityZone).toBe('DAWN');
    expect(isLivingSafetyLockActive(state)).toBe(false);
  });

  it('inferInitialSeverityFromSignalement — module sécurité isolé', () => {
    const zone = inferInitialSeverityFromSignalement(
      'Une prise du salon est arrachée et ça grésille',
    );
    expect(zone).toBe('ZENITH_DANGER');
  });

  it('nuclearFlushLivingState — vide vision, intervention et faits extraits', () => {
    let state = createLivingBuildingState({
      title: 'Fuite',
      description: 'lavabo',
      language: 'fr',
    });
    state = {
      ...state,
      vision3d: { ...state.vision3d, activeFlows: ['eau'], mentalModels: ['Plomberie'] },
      intervention: { ...state.intervention, tradeNeeded: 'Plombier' },
      humanBarrier: {
        ...state.humanBarrier,
        extractedFacts: { room: 'cuisine' },
      },
      deliberationRound: 3,
    };
    const flushed = nuclearFlushLivingState(state);
    expect(flushed.vision3d.activeFlows).toEqual([]);
    expect(flushed.intervention.tradeNeeded).toBeNull();
    expect(flushed.humanBarrier.extractedFacts).toEqual({});
    expect(flushed.deliberationRound).toBe(0);
  });

  it('nuclearFlushJarvisFacts — purge clés legacy', () => {
    const out = nuclearFlushJarvisFacts({
      langue_choisie: 'oui',
      perception_metier: 'ghost',
      trade_override: 'Plombier',
    });
    expect(out.langue_choisie).toBe('oui');
    expect(out.perception_metier).toBeUndefined();
    expect(out.trade_override).toBeUndefined();
  });

  it('purgeJarvisCognitiveFacts — efface living_building_state_v1 et fantômes carrelage', () => {
    const polluted = writeLivingStateToIntake(
      {
        objet_ancre: 'carrelage',
        zoneB_envers: 'dalle',
        extracted_room: 'chambre',
      },
      createLivingBuildingState({
        title: 'Carrelage',
        description: 'carreaux levés',
        language: 'fr',
      }),
    );
    const out = purgeJarvisCognitiveFacts(polluted);
    expect(out[LIVING_STATE_JARVIS_KEY]).toBeUndefined();
    expect(out.objet_ancre).toBeUndefined();
    expect(out.zoneB_envers).toBeUndefined();
    expect(out.extracted_room).toBeUndefined();
  });

  it('forgePristineLivingState — aucun fantôme carrelage dans dossier moisissure', () => {
    const carrelage = forgePristineLivingState({
      title: 'Carrelage',
      description: 'Les carreaux se soulèvent',
      language: 'fr',
    });
    const polluted = {
      ...carrelage,
      vision3d: {
        ...carrelage.vision3d,
        element: 'carrelage',
        symptomAnchor: 'carreau cassé',
        activeFlows: ['sol'],
      },
      legalVerdict: {
        ...carrelage.legalVerdict,
        summary: 'décollement carrelage',
        chargeHorizon: 'PATRIMOINE' as const,
      },
      symmetricDeliberation: {
        ...carrelage.symmetricDeliberation!,
        expertReports: {
          liaScenographe: { ancrage_spatial: { element: 'carrelage' } },
          enqueteur: { insight: 'sol qui lève' },
          archiviste: { insight: 'vétusté' },
          majordomeFacts: null,
        },
      },
    };

    const moisi = forgePristineLivingState({
      title: 'Moisissure',
      description: 'Taches noires sur le mur du salon',
      language: 'fr',
    });

    expect(moisi.signalementTitle).toBe('Moisissure');
    expect(moisi.vision3d.element).toBeNull();
    expect(moisi.vision3d.symptomAnchor).toBeNull();
    expect(moisi.legalVerdict.summary).toBeNull();
    expect(moisi.symmetricDeliberation?.expertReports.enqueteur).toBeNull();
    expect(moisi.symmetricDeliberation?.expertReports.liaScenographe).toBeNull();
    expect(polluted.vision3d.element).toBe('carrelage');
  });

  it('confirmation coupure → safetyVerified (module sécurité)', () => {
    let state = createLivingBuildingState({
      title: 'Électricité',
      description: 'prises arrachées',
      language: 'fr',
    });
    state = {
      ...state,
      safetyLock: {
        ...state.safetyLock,
        severityZone: 'ZENITH_DANGER',
        requiresPowerCutoff: true,
      },
    };
    state = applyLivingSafetyVerification(state, "j'ai coupé le disjoncteur");
    expect(state.safetyLock.safetyVerified).toBe(true);
    expect(isLivingSafetyLockActive(state)).toBe(false);
  });

  it('parseLivingBuildingState — schéma strict', () => {
    const raw = createLivingBuildingState({
      title: 'Fuite',
      description: 'lavabo',
      language: 'fr',
    });
    expect(parseLivingBuildingState(raw)?.schema).toBe('LIVING_BUILDING_STATE');
    expect(parseLivingBuildingState({ foo: 1 })).toBeNull();
  });
});
