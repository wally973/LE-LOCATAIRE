import {
  detectLanguageFromTenantText,
  resolveLanguageFromGreeting,
} from './lia-tenant-language';

describe('lia-tenant-language', () => {
  it('détecte le créole sur le test Miroir', () => {
    expect(
      detectLanguageFromTenantText(
        'Bonjou, dlo ap koule anba lavabo a depi m antre a.',
      ),
    ).toBe('gcf');
    expect(
      detectLanguageFromTenantText(
        'Mwen mete yon bokit men dlo a anpil, fè vit.',
      ),
    ).toBe('gcf');
  });

  it('garde le français pour un signalement classique', () => {
    expect(
      detectLanguageFromTenantText(
        'Fuite sous évier',
        'Je viens d’emménager et l’évier fuit dessous',
      ),
    ).toBe('fr');
  });

  it('ne bascule pas en créole pour « fuite sous le lavabo » en français', () => {
    expect(
      detectLanguageFromTenantText(
        'Plomberie',
        'fuite sous le lavabo depuis mon emménagement, pouvez-vous envoyer un plombier',
      ),
    ).toBe('fr');
  });

  it('Bonjou seul → gcf', () => {
    expect(resolveLanguageFromGreeting('Bonjou')).toBe('gcf');
  });
});
