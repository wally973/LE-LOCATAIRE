import { formatDiagnosticModeHeader } from './diagnostic-sensor-summary';

describe('diagnostic-sensor-summary', () => {
  it('formate le mode saison sèche', () => {
    expect(
      formatDiagnosticModeHeader({ weather_context: 'Saison sèche' }),
    ).toBe('Diagnostic établi en mode Saison sèche.');
  });
});
