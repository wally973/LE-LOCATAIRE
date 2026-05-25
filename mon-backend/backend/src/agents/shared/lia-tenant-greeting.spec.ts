import {
  INTAKE_LANGUAGE_ANSWER_ID,
  isTenantLanguageGreeting,
  resolveLanguageFromGreeting,
} from './lia-tenant-greeting';

describe('lia-tenant-greeting', () => {
  it('détecte Bonjou comme salutation langue', () => {
    expect(isTenantLanguageGreeting('Bonjou')).toBe(true);
    expect(resolveLanguageFromGreeting('Bonjou')).toBe('gcf');
  });

  it('ne confond pas eau savonneuse avec une salutation', () => {
    expect(isTenantLanguageGreeting('Eau savonneuse')).toBe(false);
  });

  it('expose id intake language_preference', () => {
    expect(INTAKE_LANGUAGE_ANSWER_ID).toBe('language_preference');
  });
});
