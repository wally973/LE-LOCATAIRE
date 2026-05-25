import type { CompanionLanguage } from '../orchestrateur/conversation/lia-companion.types';

/** Salutation seule — choix de langue, pas réponse intake technique. */
export function isTenantLanguageGreeting(message: string): boolean {
  const t = message.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!t) return false;
  const solo =
    /^(bonjou|bonjour|bonswa|bonsoir|alo|salut|hello|ola)[!?.…\s]*$/i.test(t) ||
    (/^(bonjou|bonswa|alo)\b/i.test(t) && t.length < 48 && !/eau|fuite|savon|mousse|prise|clim/i.test(t));
  return solo;
}

export function resolveLanguageFromGreeting(message: string): CompanionLanguage {
  const t = message.trim().toLowerCase();
  if (/bonjou|bonswa|alo\b/i.test(t)) return 'gcf';
  if (/bonsoir/i.test(t)) return 'fr';
  return 'fr';
}

export const INTAKE_LANGUAGE_ANSWER_ID = 'language_preference';
