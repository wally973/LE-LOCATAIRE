import type { CompanionLanguage } from '../orchestrateur/conversation/lia-companion.types';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const GCF_MARKERS =
  /\b(bonjou|bonswa|alo|mwen|nou|dlo|lavabo|bokit|anba|antre|koule|ap koule|fe vit|fè vit|pase|kay|plomb|teknisyen|bailleur)\b/gi;

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

/**
 * Miroir linguistique — détecte le créole sur tout le fil (pas seulement Bonjou).
 */
export function detectLanguageFromTenantText(
  ...parts: (string | undefined)[]
): CompanionLanguage {
  const t = norm(parts.filter(Boolean).join(' '));
  if (!t.trim()) return 'fr';

  if (isTenantLanguageGreeting(t)) {
    return resolveLanguageFromGreeting(t);
  }

  const matches = t.match(GCF_MARKERS);
  const gcfScore = matches?.length ?? 0;
  if (gcfScore >= 2) return 'gcf';
  if (gcfScore >= 1 && /(mwen|dlo|lavabo|bokit|anba|ap koule)/.test(t)) {
    return 'gcf';
  }

  return 'fr';
}

export const INTAKE_LANGUAGE_ANSWER_ID = 'language_preference';
