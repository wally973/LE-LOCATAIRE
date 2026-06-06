import { createLivingBuildingState } from './living-building-state.factory';
import { LivingGuardianService } from './living-guardian.service';
import type { LivingDeliberationTurnResult } from './living-building-state.types';

describe('living-guardian.service — Phase B', () => {
  const guardian = new LivingGuardianService();

  function baseResult(tenantMessage: string, patch?: Partial<ReturnType<typeof createLivingBuildingState>>): LivingDeliberationTurnResult {
    const living = {
      ...createLivingBuildingState({
        title: 'Électricité',
        description: 'Prise arrachée grésillement',
        language: 'fr',
        ageBand: 'senior',
      }),
      safetyLock: {
        severityZone: 'ZENITH_DANGER' as const,
        hazardType: 'electrical' as const,
        requiresPowerCutoff: true,
        requiresWaterShutoff: false,
        safetyVerified: false,
        consigneGiven: false,
        verifiedAt: null,
      },
      symmetricDeliberation: {
        level: 6 as const,
        interlocutorFace: 'locataire' as const,
        instrumentsBoard: {
          updatedAt: new Date().toISOString(),
          enqueteurInsight: 'Arc électrique',
          archivisteInsight: null,
          majordomeFactsInsight: null,
          activeFlows: [],
          mentalModels: [],
          chargeHorizon: 'INDETERMINE',
          tradeNeeded: null,
          socialProtection: null,
          constructiveDoubt: null,
          savoirCount: 0,
          pilotBrief: '—',
        },
        expertReports: {
          enqueteur: { insight: 'Arc électrique visible — danger immédiat' },
          archiviste: null,
          majordomeFacts: null,
        },
        contradictionActive: false,
        contradictionNote: null,
        doctrineVersion: 'tabula-rasa-6',
      },
      ...patch,
    };
    return {
      livingState: living,
      tenantMessage,
      intakeComplete: false,
      handoffRequired: false,
      handoffReason: null,
    };
  }

  it('coherence — ampoule vs arc électrique → RE-DELIBERATE', () => {
    const review = guardian.review({
      result: baseResult(
        'Marie, changez l’ampoule du plafonnier, c’est sans doute grillée.',
        {
          safetyLock: {
            severityZone: 'DAWN',
            hazardType: 'none',
            requiresPowerCutoff: false,
            requiresWaterShutoff: false,
            safetyVerified: false,
            consigneGiven: false,
            verifiedAt: null,
          },
        },
      ),
    });
    expect(review.verdict).toBe('RE-DELIBERATE');
    expect(review.missionsTriggered).toContain('COHERENCE');
    expect(review.redeliberationBrief).toMatch(/danger électrique/i);
  });

  it('safety — ZENITH sans consigne → OVERRIDE en-tête', () => {
    const review = guardian.review({
      result: baseResult(
        'Marie, décrivez-moi mieux ce qui se passe au salon.',
      ),
    });
    expect(review.verdict).toBe('OVERRIDE');
    expect(review.missionsTriggered).toContain('SAFETY');
    expect(review.finalParole).toMatch(/disjoncteur|éloign/i);
  });

  it('social — consigne physique + sénior → OVERRIDE', () => {
    const review = guardian.review({
      result: baseResult('Marie, montez sur un escabeau pour atteindre le plafond.', {
        safetyLock: {
          severityZone: 'DAWN',
          hazardType: 'none',
          requiresPowerCutoff: false,
          requiresWaterShutoff: false,
          safetyVerified: false,
          consigneGiven: false,
          verifiedAt: null,
        },
        symmetricDeliberation: {
          level: 6 as const,
          interlocutorFace: 'locataire' as const,
          instrumentsBoard: baseResult('x').livingState.symmetricDeliberation.instrumentsBoard,
          expertReports: {
            enqueteur: { insight: 'Humidité en surface — pas de danger électrique' },
            archiviste: null,
            majordomeFacts: null,
          },
          contradictionActive: false,
          contradictionNote: null,
          doctrineVersion: 'tabula-rasa-6',
        },
      }),
      tenantSocial: { ageBand: 'senior', displayName: 'Marie' },
    });
    expect(review.verdict).toBe('OVERRIDE');
    expect(review.missionsTriggered).toContain('SOCIAL');
    expect(review.finalParole).not.toMatch(/escabeau/i);
  });

  it('doctrine — leçons pending → murmures Stylo', () => {
    const review = guardian.review({
      result: baseResult('Marie, je vous écoute.', {
        safetyLock: {
          severityZone: 'DAWN',
          hazardType: 'none',
          requiresPowerCutoff: false,
          requiresWaterShutoff: false,
          safetyVerified: false,
          consigneGiven: false,
          verifiedAt: null,
        },
      }),
      pendingDoctrineLessons: [
        {
          id: '2026-05-29-test',
          author: 'enqueteur',
          title: 'Test leçon',
          status: 'PENDING_ADMIN_SIGNATURE',
          filePath: '/tmp/x.md',
        },
      ],
    });
    expect(review.missionsTriggered).toContain('DOCTRINE');
    expect(review.murmures.some((m) => /PENDING_ADMIN_SIGNATURE/i.test(m))).toBe(true);
  });

  it('PASS — parole alignée sécurité', () => {
    const review = guardian.review({
      result: baseResult(
        'Marie, éloignez-vous tout de suite — coupez le disjoncteur si vous pouvez sans danger.',
      ),
    });
    expect(review.verdict).toBe('PASS');
  });
});
