import { isSkipPhotoIntent } from './lia-agent-intents';

describe('isSkipPhotoIntent', () => {
  it('détecte caméra mobile en panne', () => {
    expect(
      isSkipPhotoIntent(
        'la caméra de mon mobile ne fonctionne pas que dois-je faire?',
      ),
    ).toBe(true);
  });

  it('détecte sans photo explicite', () => {
    expect(isSkipPhotoIntent('je continue sans photo')).toBe(true);
  });

  it('ne déclenche pas sur une simple question métier', () => {
    expect(isSkipPhotoIntent('l interrupteur ne marche pas')).toBe(false);
  });
});
