import { scoreSignalQuality } from './signal-quality.scorer';

describe('scoreSignalQuality (Couche 0)', () => {
  it('pénalise un texte très court', () => {
    const { signalQuality } = scoreSignalQuality({
      title: 'fuite',
      description: '',
      tenantMessage: '',
      sessionMessages: [],
      visualPerceptionRaw: null,
      hasImage: false,
    });
    expect(signalQuality).toBeLessThan(6);
  });

  it('pénalise une perception floue sans diagnostiquer', () => {
    const { signalQuality, factors } = scoreSignalQuality({
      title: 'Fuite chauffe-eau solaire',
      description: 'Vanne fermée, fuite visible au ballon dans le logement.',
      tenantMessage: 'fuite au ballon dans la cuisine',
      sessionMessages: [],
      visualPerceptionRaw:
        '- DISPOSITION : photo sombre et floue, angle difficile.\n- Peu lisible.',
      hasImage: true,
    });
    expect(factors.imageQuality).toBeLessThan(6);
    expect(signalQuality).toBeLessThan(7);
  });

  it('récompense un signal texte + image structurée', () => {
    const { signalQuality } = scoreSignalQuality({
      title: 'Infiltration buanderie',
      description: 'Trace d humidité au plafond depuis trois jours, étage 2.',
      tenantMessage: 'la tache s agrandit au plafond de la buanderie',
      sessionMessages: [],
      visualPerceptionRaw:
        '- DISPOSITION : plafond buanderie, tache brune en hauteur.\n- HAUTE DÉFINITION : auréole humidité, joint visible.',
      hasImage: true,
    });
    expect(signalQuality).toBeGreaterThanOrEqual(6);
  });
});
