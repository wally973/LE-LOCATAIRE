import { parseJarvisLlmBridgePayload } from './lia-jarvis-llm-bridge';

describe('lia-jarvis-llm-bridge', () => {
  it('parse une visualisation refoulement EU (exutoire) sans règles scriptées', () => {
    const raw = JSON.stringify({
      language: 'fr',
      domain: 'plumbing_sink',
      mentalModels: [
        'Exutoire (3 verres): évier plein — aval colonne EU probablement bouchée avant fuite amont.',
      ],
      physicalFlows: ['eau'],
      scene3d: {
        floorLevel: 'R+2',
        room: 'cuisine',
        above: 'logements desservis au-dessus',
        below: 'descente eaux usées / colonne immeuble',
        element: 'évier → siphon → descente EU',
        symptomAnchor: 'évier plein eau sale — cuisine inondée',
      },
      hypotheses: [
        {
          id: 'eu_refoulement_column',
          label: 'Refoulement EU — colonne bouchée',
          visualization:
            'L’eau sale remonte par la descente : exutoire aval bouché, pas simple fuite sous l’évier.',
          active: true,
          confidence: 0.92,
        },
      ],
      visualizationSummary:
        'Refoulement probable sur colonne EU — intervention hydrocureur sur descente immeuble.',
      acknowledgment:
        'Marie, c’est urgent : évier plein d’eau sale et cuisine inondée. Je transmets en priorité au bailleur pour un hydrocureur sur la colonne, pas une fuite sous l’évier.',
      nextQuestion: null,
      intakeComplete: true,
      handoffRequired: false,
      extractedFacts: { intervention: 'hydrocureur' },
    });

    const result = parseJarvisLlmBridgePayload(raw, { language: 'fr' });
    expect(result).not.toBeNull();
    expect(result!.simulation.domain).toBe('plumbing_sink');
    expect(result!.simulation.scene.below).toMatch(/colonne|descente/i);
    expect(result!.simulation.mentalModels[0]).toMatch(/exutoire|3 verres/i);
    expect(result!.intakeComplete).toBe(true);
    expect(result!.nextQuestion).toBeNull();
    expect(result!.acknowledgment).toMatch(/hydrocur|colonne/i);
  });

  it('parse une visualisation gâche / porte sans apprentissage métier préalable', () => {
    const raw = JSON.stringify({
      language: 'fr',
      domain: 'carpentry_door',
      mentalModels: ['Mécanique porte: gâche désalignée ou pêne qui accroche.'],
      physicalFlows: ['mécanique'],
      scene3d: {
        room: 'chambre',
        element: 'porte / gâche / serrure',
        symptomAnchor: 'clé tourne — porte ne s’ouvre pas',
      },
      hypotheses: [
        {
          id: 'lock_misalign',
          label: 'Gâche ou serrure désalignée',
          visualization: 'Je visualise le pêne qui n’entre plus dans la gâche.',
          active: true,
          confidence: 0.85,
        },
      ],
      visualizationSummary: 'Gâche ou serrure — désalignement mécanique probable.',
      acknowledgment:
        'Marie, je comprends : la clé tourne mais la porte reste bloquée — je visualise plutôt un souci de gâche ou de serrure qu’une urgence structurelle.',
      nextQuestion: 'Y a-t-il quelqu’un enfermé derrière la porte ?',
      intakeComplete: false,
      handoffRequired: false,
    });

    const result = parseJarvisLlmBridgePayload(raw, { language: 'fr' });
    expect(result!.simulation.domain).toBe('carpentry_door');
    expect(result!.simulation.hypotheses[0].label).toMatch(/gâche/i);
    expect(result!.nextQuestion).toMatch(/enferm/i);
    expect(result!.intakeComplete).toBe(false);
  });

  it('tolère des champs non-string renvoyés par Groq', () => {
    const raw = JSON.stringify({
      language: 'fr',
      domain: 'plumbing_sink',
      mentalModels: ['Exutoire'],
      physicalFlows: ['eau'],
      hypotheses: [
        {
          id: 1,
          label: 'Fuite plafond',
          visualization: 42,
          active: true,
          confidence: '0.8',
        },
      ],
      visualizationSummary: 'Eau depuis le plafond derrière WC',
      acknowledgment: 'Marie, je visualise des gouttes au plafond derrière les toilettes.',
      nextQuestion: null,
      intakeComplete: true,
      handoffRequired: false,
    });

    const result = parseJarvisLlmBridgePayload(raw, { language: 'fr' });
    expect(result).not.toBeNull();
    expect(result!.simulation.hypotheses[0].id).toBe('1');
    expect(result!.simulation.hypotheses[0].visualization).toBe('42');
  });
});
