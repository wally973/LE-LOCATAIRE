import {
  classifySocialRiskFromText,
  resolveAiCategoryFromContext,
  resolveSeverityFromContext,
} from './diagnostic-ticket-insights';
import type { TicketDiagnosticContext } from './diagnostic-context.service';

function ctx(partial: Partial<TicketDiagnosticContext>): TicketDiagnosticContext {
  return {
    ticketId: 1,
    title: 'Test',
    description: partial.description ?? '',
    diagnostic: partial.diagnostic ?? null,
    sensors: partial.sensors ?? {},
    caseContext: partial.caseContext ?? partial.description ?? '',
    intake: partial.intake ?? null,
    savoirVoirPhase: partial.savoirVoirPhase ?? 'OBSERVATION',
    tenantSupplement: '',
  };
}

describe('diagnostic-ticket-insights', () => {
  it('catégorise une fuite via le domaine Savoir-Voir', () => {
    const category = resolveAiCategoryFromContext(
      ctx({
        description: 'fuite sous l’évier depuis hier',
        caseContext: 'fuite sous l’évier depuis hier',
      }),
    );
    expect(category).toBe('PLUMBING');
  });

  it('détecte urgence électrique via capteur danger', () => {
    const severity = resolveSeverityFromContext(
      ctx({
        sensors: { danger_signs: 'grésillement / odeur de brûlé' },
      }),
    );
    expect(severity).toBe('URGENT_CRITIQUE');
  });

  it('aligne le risque social sur detectSocialSignal', () => {
    const low = classifySocialRiskFromText('fuite WC');
    expect(low.socialSignal).toBe(false);

    const high = classifySocialRiskFromText('violence conjugale au logement');
    expect(high.socialSignal).toBe(true);
    expect(high.risk).toBe('HIGH');
  });
});
