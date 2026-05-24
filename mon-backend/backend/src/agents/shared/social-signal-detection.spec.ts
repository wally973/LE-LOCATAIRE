import { detectSocialSignal } from './social-signal-detection';

describe('social-signal-detection', () => {
  it('détecte impayé / difficultés', () => {
    expect(detectSocialSignal('je n’arrive plus à payer mon loyer')).toBe(true);
  });

  it('ignore une fuite technique', () => {
    expect(detectSocialSignal('fuite sous l’évier depuis hier')).toBe(false);
  });
});
