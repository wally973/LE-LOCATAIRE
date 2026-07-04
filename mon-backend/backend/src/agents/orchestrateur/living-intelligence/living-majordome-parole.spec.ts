import {
  buildDeliberationFallbackParole,
  extractExpertInsight,
  isJsonLeak,
  unwrapMajordomeParole,
} from './living-majordome-parole';

describe('living-majordome-parole', () => {
  it('extrait message depuis JSON Groq (clé message)', () => {
    const raw =
      '{"message":"Bonjour Marie, les carreaux se sont levés.","action":"awaiting_tenant_response"}';
    expect(unwrapMajordomeParole(raw)).toBe('Bonjour Marie, les carreaux se sont levés.');
  });

  it('extrait tenantMessage', () => {
    expect(
      unwrapMajordomeParole('{"tenantMessage":"Je vous accompagne."}'),
    ).toBe('Je vous accompagne.');
  });

  it('extrait insight quand le modèle renvoie du JSON expert par erreur', () => {
    expect(
      unwrapMajordomeParole(
        '{"insight":"Marie, le mur froid évoque un pont thermique ou une infiltration."}',
      ),
    ).toBe('Marie, le mur froid évoque un pont thermique ou une infiltration.');
  });

  it('détecte fuite JSON', () => {
    expect(isJsonLeak('{"message":"x","action":"y"}')).toBe(true);
    expect(isJsonLeak('Bonjour Marie')).toBe(false);
  });

  it('fallback délibération — utilise la synthèse enquêteur, pas le générique', () => {
    const msg = buildDeliberationFallbackParole({
      displayName: 'Marie',
      tenantMessage: 'oui le mur est froid',
      mode: 'tenant_turn',
      signalementTitle: 'Humidité',
      enqueteurInsight: 'Le mur froid après pluie oriente vers infiltration ou pont thermique.',
      archivisteInsight: null,
      constructiveDoubt: null,
    });
    expect(msg).toMatch(/pont thermique|infiltration/i);
    expect(msg).not.toMatch(/je vous écoute — merci/i);
  });

  it('fallback — question juridique RTAA via archiviste', () => {
    const msg = buildDeliberationFallbackParole({
      displayName: 'Marie',
      tenantMessage: 'Pourquoi papier peint dangereux en Guyane RTAA-DOM ?',
      mode: 'tenant_turn',
      signalementTitle: 'Humidité',
      enqueteurInsight: 'Piste humidité mur.',
      archivisteInsight:
        'En climat tropical humide, papier peint retient l’eau et favorise moisissures — RTAA-DOM exige respirabilité.',
      constructiveDoubt: null,
    });
    expect(msg).toMatch(/RTAA|moisissure|respirabilit/i);
  });

  it('extractExpertInsight — hypotheses sans champ insight', () => {
    const insight = extractExpertInsight({
      hypotheses: [{ label: 'Pont thermique', visualization: 'mur froid permanent' }],
      visualLogicNotes: 'Envisager exutoire aval avant amont.',
    });
    expect(insight).toMatch(/pont thermique|mur froid/i);
  });

  it('fallback — ne boucle pas sur pluie/chaleur après réponse temporelle', () => {
    const msg = buildDeliberationFallbackParole({
      displayName: 'Marie',
      tenantMessage: 'non tout le temps',
      mode: 'tenant_turn',
      signalementTitle: 'Humidité mur froid',
      signalementDescription: 'Taches et moisissures sur mur froid',
      activeFlows: ['humidite'],
      enqueteurInsight: null,
      archivisteInsight: null,
      constructiveDoubt: null,
    });
    expect(msg).toMatch(/permanent|moisi|odeur/i);
    expect(msg).not.toMatch(/pluie ou par forte chaleur/i);
    expect(msg).not.toMatch(/j’ai bien noté/i);
  });

  it('fallback — excuse et avance après frustration locataire', () => {
    const msg = buildDeliberationFallbackParole({
      displayName: 'Marie',
      tenantMessage: 'pourquoi tu me répètes la phrase?',
      mode: 'tenant_turn',
      signalementTitle: 'Humidité',
      signalementDescription: 'Mur froid avec moisissures',
      activeFlows: ['humidite'],
      enqueteurInsight: null,
      archivisteInsight: null,
      constructiveDoubt: null,
    });
    expect(msg).toMatch(/pardon|repren/i);
    expect(msg).not.toMatch(/j’ai bien noté/i);
    expect(msg).not.toMatch(/pluie ou par forte chaleur/i);
  });
});
