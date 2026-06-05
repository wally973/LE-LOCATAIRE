import { isJsonLeak, unwrapMajordomeParole } from './living-majordome-parole';

describe('living-majordome-parole', () => {
  it('extrait message depuis JSON Groq (clé message)', () => {
    const raw =
      '{"message":"Bonjour Marie, les carreaux se sont levés.","action":"awaiting_tenant_response"}';
    expect(unwrapMajordomeParole(raw)).toBe('Bonjour Marie, les carreaux se sont levés.');
  });

  it('extrait tenantMessage', () => {
    expect(
      unwrapMajordomeParole('{"tenantMessage":"Je vous accompagne."}'),
    ).toBe('Je vous accompagne.');
  });

  it('détecte fuite JSON', () => {
    expect(isJsonLeak('{"message":"x","action":"y"}')).toBe(true);
    expect(isJsonLeak('Bonjour Marie')).toBe(false);
  });
});
