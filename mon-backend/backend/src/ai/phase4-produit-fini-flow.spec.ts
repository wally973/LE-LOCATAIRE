/**
 * Test final Phase 4 — du « Bonjou » (créole) au diagnostic complet clim Guyane.
 */
import { LiaCompanionService } from '../agents/orchestrateur/conversation/lia-companion.service';
import { LiaHostService } from '../agents/orchestrateur/conversation/lia-host.service';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import { extractDiagnosticSensors } from '../agents/shared/lia-diagnostic-sensors';
import { AiPhotoService } from './ai-photo.service';
import { AiSummarizerService } from './ai-summarizer.service';
import { AiInsuranceService } from './ai-insurance.service';
import { AiLegalService } from './ai-legal.service';
import { LiaPathologistService } from '../ai-routing/agents/lia-pathologist.service';
import { LiaJuristService } from '../ai-routing/agents/lia-jurist.service';
import { AiPipelineLiaAdapter } from '../ai-routing/ai-pipeline-lia.adapter';

describe('Phase 4 — produit fini (clim Guyane, saison sèche)', () => {
  const title = 'Climatisation qui fuit';
  const description =
    'Bonjou, la clim fuit eau sous le split bac condensat bouche saison seche pas de pluie';

  const sensors = extractDiagnosticSensors({
    contextText: `${title} ${description}`,
  });

  it('1. Accueil créole « Bonjou »', async () => {
    const companion = new LiaCompanionService(new LiaHostService());
    const greeting = await companion.produceGuidance({
      title: '—',
      description: '',
      category: 'GENERIC',
      tenantFirstName: 'Marie',
      tenantMessage: 'Bonjou',
    });
    expect(greeting.language).toBe('gcf');
    expect(greeting.speech).toMatch(/Bonjou/i);
  });

  it('2–5. Photo → pipeline → assurance/juridique → synthèse capteurs', async () => {
    expect(sensors.weather_context).toBe('Saison sèche');

    const diagnosticContext = {
      fromTicket: async () => ({
        ticketId: 42,
        title,
        description,
        diagnostic: null,
        sensors,
        caseContext: description,
        intake: null,
        savoirVoirPhase: 'HYPOTHESES' as const,
        tenantSupplement: '',
      }),
      fromParts: async () => ({
        ticketId: 42,
        title,
        description,
        diagnostic: null,
        sensors,
        caseContext: description,
        intake: null,
        savoirVoirPhase: 'HYPOTHESES' as const,
        tenantSupplement: '',
      }),
    } as unknown as DiagnosticContextService;

    const pathologist = new LiaPathologistService(diagnosticContext);
    const photoSvc = new AiPhotoService(pathologist, diagnosticContext);

    const photo = await photoSvc.analyzePhoto('http://localhost/uploads/clim-test.jpg', {
      title,
      description,
    });
    expect(photo.category).toBe('HEATING');
    expect(photo.differential?.leadingHypothesisId).toBe(
      'hyp_hvac_condensate_blocked',
    );

    const jurist = new LiaJuristService({ searchRelevant: async () => [], formatForPrompt: () => '' } as never);
    const pipeline = new AiPipelineLiaAdapter(
      pathologist,
      jurist,
      { searchRelevant: async () => [] } as never,
      { analyze: async () => ({ responsibility: 'PENDING', message: '', category: 'OTHER', severity: 'LOW', confidence: 0, needsMorePhoto: true, socialFlag: false, pipelineSteps: [] }) } as never,
    );

    const decision = await pipeline.analyze({
      title,
      description,
      attempt: 1,
      photoUrls: ['http://localhost/uploads/clim-test.jpg'],
      diagnosticSensors: sensors,
      ticketId: 42,
      locale: 'fr-FR',
    });

    expect(decision.responsibility).toBe('LOCATAIRE');
    expect(decision.category).toBe('HEATING');

    const insurance = new AiInsuranceService({} as never, diagnosticContext);
    const claim = await insurance.assessSinistreForTicket(42);
    expect(claim.sensors.weather_context).toBe('Saison sèche');
    expect(claim.notes.some((n) => /Contexte météo/.test(n))).toBe(true);

    const legal = new AiLegalService(
      {} as never,
      diagnosticContext,
      { getCatalog: async () => ({ version: 1, updatedAt: '', entries: [] }), search: async () => [] } as never,
    );
    const legalBrief = await legal.assessCollectiveEvacuationForTicket(42);
    expect(legalBrief.applies).toBe(false);

    const summarizer = new AiSummarizerService();
    const summary = summarizer.buildTenantFinalSummary({
      ticket: { id: 42, title, description },
      decision,
      pathologist: {
        category: 'HEATING',
        severity: decision.severity,
        confidence: decision.confidence,
        needsMorePhoto: false,
        observation: photo.description,
        fromLlm: false,
        differential: photo.differential,
        hvacPhoto: photo.hvacPhoto,
      },
      sensors,
      insuranceNotes: claim.notes,
      legalSummary: legalBrief.applies ? legalBrief.summary : null,
    });

    expect(summary).toContain('Diagnostic établi en mode Saison sèche');
    expect(summary).toMatch(/condensat|LOCATAIRE|charge locataire/i);
    expect(summary).toMatch(/Contexte météo/);
  });
});
