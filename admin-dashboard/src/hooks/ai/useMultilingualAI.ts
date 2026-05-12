import { useCallback, useMemo } from 'react';
import { refusalMessage } from './refusalMessages.i18n';

export type SupportedLocale =
  | 'fr'
  | 'en'
  | 'ht'
  | 'pt-BR'
  | 'es-DO';

const NAMES: Record<SupportedLocale, string> = {
  fr: 'Français',
  en: 'English',
  ht: 'Kreyòl ayisyen',
  'pt-BR': 'Português (Brasil)',
  'es-DO': 'Español (Rep. Dominicana)',
};

/**
 * Adaptation multilingue — stub d’empilement front : garde le texte source + balise langue.
 * Brancher ici un service de traduction contrôlé (même bride) côté backend.
 */
export function useMultilingualAI() {
  const translate = useCallback(
    (text: string, target: SupportedLocale, _source: SupportedLocale = 'fr') => {
      if (target === 'fr') return text;
      return `[${NAMES[target]}] ${text}`;
    },
    [],
  );

  const adaptUserFacingText = useCallback(
    (messageFr: string, locale: SupportedLocale, isRefusal: boolean) => {
      if (isRefusal) return refusalMessage(locale);
      return translate(messageFr, locale, 'fr');
    },
    [translate],
  );

  return useMemo(
    () => ({
      translate,
      adaptUserFacingText,
      localeNames: NAMES,
    }),
    [translate, adaptUserFacingText],
  );
}
