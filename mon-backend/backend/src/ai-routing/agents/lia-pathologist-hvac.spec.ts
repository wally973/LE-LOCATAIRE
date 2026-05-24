import { LiaPathologistService } from './lia-pathologist.service';

describe('LiaPathologistService — clim simulation', () => {
  const sensors = { weather_context: 'Saison sèche' };

  function pathologist() {
    return new LiaPathologistService({
      fromTicket: async () => ({
        ticketId: 1,
        title: 'Clim qui fuit',
        description: '',
        diagnostic: null,
        sensors,
        caseContext: '',
        intake: null,
        savoirVoirPhase: 'OBSERVATION',
        tenantSupplement: '',
      }),
      fromParts: async () => ({
        ticketId: 0,
        title: '',
        description: '',
        diagnostic: null,
        sensors,
        caseContext: '',
        intake: null,
        savoirVoirPhase: 'OBSERVATION',
        tenantSupplement: '',
      }),
    } as never);
  }

  it('intègre le différentiel clim avec capteurs', async () => {
    const svc = pathologist();
    const result = await svc.analyze({
      title: 'Climatisation',
      description:
        'eau sous le split bac condensat bouche auréole sombre plafond saison seche',
      attempt: 1,
      photoUrls: ['http://localhost/uploads/test.jpg'],
      diagnosticSensors: sensors,
      locale: 'fr-FR',
    });

    expect(result.category).toBe('HEATING');
    expect(result.differential?.leadingHypothesisId).toBeDefined();
    expect(result.hvacPhoto).toBeDefined();
  });
});
