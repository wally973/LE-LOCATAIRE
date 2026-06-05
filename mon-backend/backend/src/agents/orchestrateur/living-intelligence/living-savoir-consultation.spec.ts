import { consultArchivisteSavoir, consultEnqueteurSavoir } from './living-savoir-consultation';

describe('living-savoir-consultation', () => {
  it('moisissures → fiches AQC/AFPOLS consultées par Enquêteur', () => {
    const { consultations, perceptionBrief } = consultEnqueteurSavoir(
      'Moisissures au plafond du salon quand il pleut, taches noires près de la fenêtre',
    );
    expect(consultations.length).toBeGreaterThan(0);
    expect(consultations.some((c) => c.agent === 'enqueteur')).toBe(true);
    expect(consultations.some((c) => c.corpus === 'AQC' || c.corpus === 'AFPOLS')).toBe(
      true,
    );
    expect(perceptionBrief).toMatch(/PERCEPTION MÉTIER/i);
    expect(perceptionBrief).not.toMatch(/\[AQC/);
  });

  it('Archiviste ouvre 87-712, 87-713 et cours AFPOLS', () => {
    const { consultations, perceptionBrief } = consultArchivisteSavoir(
      'Moisissures au plafond quand il pleut — infiltration toiture',
    );
    expect(consultations.some((c) => c.ref.includes('87-712'))).toBe(true);
    expect(consultations.some((c) => c.ref.includes('87-713'))).toBe(true);
    expect(consultations.some((c) => c.corpus === 'AFPOLS')).toBe(true);
    expect(perceptionBrief).toMatch(/TRIPLE FLUX/i);
    expect(perceptionBrief).toMatch(/87-713/i);
  });
});
