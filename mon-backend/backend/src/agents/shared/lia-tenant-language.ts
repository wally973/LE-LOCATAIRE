import type { CompanionLanguage } from '../orchestrateur/conversation/lia-companion.types';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Mots / tournures clairement kréyòl (pas « lavabo » ou « plomb » partagés avec le français). */
const STRONG_GCF =
  /\b(bonjou|bonswa|alo|mwen|nou|dlo|bokit|anba|antre|koule|ap koule|fe vit|f[eè] vit|yon |mo ka|m ka|pou mwen|pou nou|ki kote|ki sa|ki jan|touswit|anpil)\b/gi;

/** Français standard du locataire (signalement rédigé en français). */
const FRENCH_DOMINANT =
  /\b(je |j'|vous |nous |mon |ma |mes |le |la |les |des |du |de la |sous |depuis |chez |merci|bonjour|bonsoir|fuite|évier|evier|lavabo|emménag|plombier|pouvez|envoyer|constat|problème|probleme)\b/gi;

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
 * Miroir linguistique — créole seulement si le texte l’indique clairement (pas un faux positif sur « lavabo »).
 */
export function detectLanguageFromTenantText(
  ...parts: (string | undefined)[]
): CompanionLanguage {
  const t = norm(parts.filter(Boolean).join(' '));
  if (!t.trim()) return 'fr';

  if (isTenantLanguageGreeting(t)) {
    return resolveLanguageFromGreeting(t);
  }

  const strongGcf = (t.match(STRONG_GCF) ?? []).length;
  const frenchHits = (t.match(FRENCH_DOMINANT) ?? []).length;

  if (strongGcf >= 2) return 'gcf';
  if (strongGcf >= 1 && frenchHits === 0) return 'gcf';
  if (frenchHits >= 2 && strongGcf === 0) return 'fr';
  if (frenchHits >= 1 && strongGcf === 0) return 'fr';

  return 'fr';
}

export const INTAKE_LANGUAGE_ANSWER_ID = 'language_preference';
