import type { GrockConversationState } from '../grock.service';

/**
 * Garde-fous MINIMAUX sur la parole visible — confiance au LLM.
 *
 * On ne remplace plus la réponse Mistral par des templates par état.
 * On corrige seulement : vide, mot nu, ou fuite d'identifiant interne.
 */

export function isDegenerateAcknowledgment(ack: string): boolean {
  const t = ack.trim();
  if (!t) return true;
  if (t.includes('?')) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length < 3;
}

export function stripInternalJargon(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b[A-Z]{2,}\d[A-Z0-9]*\b/g, '')
    .replace(/\b[A-Z]\d{2,}[A-Z0-9]*\b/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,])/g, '$1')
    .trim();
}

const SAFE_GENERIC_ACK =
  'Dites-moi ce que vous voyez maintenant : où se situe le problème et depuis quand ?';

/**
 * Choisit la parole visible : priorité à Mistral (acknowledgment), puis next_action
 * si le modèle a mis la phrase au mauvais endroit — jamais de script par état.
 */
export function resolveVisibleSpeech(params: {
  acknowledgment: string;
  nextAction: string;
  state: GrockConversationState;
}): string {
  const ack = stripInternalJargon(params.acknowledgment.trim());
  if (ack && !isDegenerateAcknowledgment(ack)) {
    return ack;
  }

  const next = stripInternalJargon(params.nextAction.trim());
  if (next && !isDegenerateAcknowledgment(next)) {
    return next;
  }

  if (ack) return ack;
  return SAFE_GENERIC_ACK;
}
