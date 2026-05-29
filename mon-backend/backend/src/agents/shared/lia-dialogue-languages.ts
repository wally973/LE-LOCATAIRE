import type { CompanionLanguage } from '../orchestrateur/conversation/lia-companion.types';
import { detectLanguageFromTenantText } from './lia-tenant-language';

/** Langues proposées au locataire (choix explicite — pas de miroir automatique). */
export const LIA_DIALOGUE_LANGUAGE_OPTIONS: ReadonlyArray<{
  code: CompanionLanguage;
  labelFr: string;
  nativeLabel: string;
}> = [
  { code: 'fr', labelFr: 'Français', nativeLabel: 'Français' },
  { code: 'gcf', labelFr: 'Créole guyanais', nativeLabel: 'Krèyòl gwiyannen' },
  { code: 'en', labelFr: 'Anglais', nativeLabel: 'English' },
  { code: 'pt', labelFr: 'Portugais (Brésil)', nativeLabel: 'Português' },
  { code: 'es', labelFr: 'Espagnol (Caraïbes)', nativeLabel: 'Español' },
  { code: 'hat', labelFr: 'Créole haïtien', nativeLabel: 'Kreyòl ayisyen' },
] as const;

const ALLOWED = new Set<CompanionLanguage>(
  LIA_DIALOGUE_LANGUAGE_OPTIONS.map((o) => o.code),
);

export function normalizeCompanionLanguage(
  value: string | undefined | null,
): CompanionLanguage {
  const v = (value ?? 'fr').trim().toLowerCase() as CompanionLanguage;
  return ALLOWED.has(v) ? v : 'fr';
}

export function labelDialogueLanguageFr(code: CompanionLanguage): string {
  return (
    LIA_DIALOGUE_LANGUAGE_OPTIONS.find((o) => o.code === code)?.labelFr ?? 'Français'
  );
}

/** Langue déjà choisie par le locataire (ne pas écraser par détection auto). */
export function hasExplicitLanguageChoice(state: {
  preferredLanguage?: string;
  answers?: Record<string, string>;
  jarvisFacts?: Record<string, string>;
}): boolean {
  return (
    Boolean(state.answers?.language_preference) ||
    state.jarvisFacts?.langue_choisie === 'oui'
  );
}

export function resolveLanguageForIntake(
  state: {
    preferredLanguage?: string;
    answers?: Record<string, string>;
    jarvisFacts?: Record<string, string>;
  },
  ...detectParts: (string | undefined)[]
): CompanionLanguage {
  if (hasExplicitLanguageChoice(state) && state.preferredLanguage) {
    return normalizeCompanionLanguage(state.preferredLanguage);
  }
  return detectLanguageFromTenantText(...detectParts);
}
