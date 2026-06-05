import { AiInsuranceService } from './ai-insurance.service';
import type { TicketDiagnosticContext } from '../agents/shared/diagnostic-context.service';

describe('AiInsuranceService — refoulement EU (REF_EAU_SAVONNEUSE)', () => {
  const refCtx: TicketDiagnosticContext = {
    ticketId: 42,
    title: 'Eau au salon',
    description: 'flaque savonneuse',
    diagnostic: null,
    sensors: {
      water_aspect: 'savonneuse/mousseuse',
      building_floor: 'R+1',
      timing_pattern: '19h-21h',
      weather_context: 'Saison sèche',
    },
    caseContext: '',
    intake: null,
    savoirVoirPhase: 'HYPOTHESES',
    tenantSupplement: '',
    tenantSocial: null,
  };

  function serviceWithContext(ctx: TicketDiagnosticContext) {
    return new AiInsuranceService(
      {} as never,
      { fromTicket: async () => ctx } as never,
    );
  }

  it('ajoute une note collective si eau savonneuse en R+1', async () => {
    const svc = serviceWithContext(refCtx);
    const assessment = await svc.assessSinistreForTicket(42);

    expect(assessment.refoulementEuSuspected).toBe(true);
    expect(assessment.responsibilityHint).toBe('BAILLEUR_COLLECTIF');
    expect(assessment.notes.join(' ')).toMatch(/collective|refoulement/i);
    expect(assessment.notes.join(' ')).toMatch(/19h-21h/);
  });

  it('ne déclenche pas la note si aspect clair', async () => {
    const svc = serviceWithContext({
      ...refCtx,
      sensors: { water_aspect: 'claire', building_floor: 'R+1' },
    });
    const assessment = await svc.assessSinistreForTicket(42);
    expect(assessment.refoulementEuSuspected).toBe(false);
    expect(assessment.notes).toHaveLength(0);
  });
});
