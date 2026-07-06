import type { GrockInterlocutor } from '../../../kernel/grock-interlocutor';
import type { GrockHeadInputs } from '../../../head-input/head-input.types';

const PREVENIR_VOISIN_LOCATAIRE_RE =
  /pr[eé]venez|pr[eé]venir (votre|le) voisin|contactez (votre )?voisin|parlez[- ]à (votre )?voisin|voisin du dessus pour l['’]alerter/i;

const BAILLEUR_ALERTE_VOISIN_RE =
  /nous (allons |)(alerter|pr[eé]venir|contacter) le voisin|le bailleur alertera/i;

const SUPPLEMENT_PREVENIR_VOISIN =
  'Si un logement est au-dessus du vôtre, prévenez votre voisin du dessus pour l’alerter de la fuite — cela facilite l’identification de l’origine et le constat amiable si besoin.';

const SUPPLEMENT_SINISTRE_THEMES =
  'Pensez aussi à sécuriser la zone humide, conserver des photos comme preuve, et déclarer le sinistre à votre assurance habitation dans les 5 jours ouvrés.';

export function mentionsPrevenirVoisinDessus(text: string): boolean {
  return PREVENIR_VOISIN_LOCATAIRE_RE.test(text);
}

function mentionsSecurite(text: string): boolean {
  return /s[eé]cur|danger|urgence|ne touchez|[eé]loign|lectri|humide/i.test(text);
}

function mentionsAssurance(text: string): boolean {
  return /assur|sinistre|5\s*jour|cinq\s*jour/i.test(text);
}

function mentionsPhoto(text: string): boolean {
  return /photo|preuve|image|envoy/i.test(text);
}

function appendSentence(ack: string, sentence: string): string {
  const trimmed = ack.trim();
  if (!trimmed) return sentence;
  const sep = /[.!?…]$/.test(trimmed) ? ' ' : '. ';
  return `${trimmed}${sep}${sentence}`;
}

function appendPrevenirVoisinDessus(
  acknowledgment: string,
  originFromAbove: boolean,
): string {
  if (!originFromAbove) return acknowledgment;
  const ack = acknowledgment.trim();
  if (!ack || mentionsPrevenirVoisinDessus(ack)) return acknowledgment;

  if (BAILLEUR_ALERTE_VOISIN_RE.test(ack)) {
    return appendSentence(
      ack,
      `En parallèle, si vous le pouvez, ${SUPPLEMENT_PREVENIR_VOISIN.charAt(0).toLowerCase()}${SUPPLEMENT_PREVENIR_VOISIN.slice(1)}`,
    );
  }
  return appendSentence(ack, SUPPLEMENT_PREVENIR_VOISIN);
}

/**
 * Garde-fous Tête 5 — phrases d’appoint si sinistre probable/candidat
 * et thèmes essentiels absents de la parole (pas de script complet).
 */
export function applyHead5ParoleSupplements(
  acknowledgment: string,
  inputs: GrockHeadInputs,
  interlocutor: GrockInterlocutor,
  state?: string | null,
): string {
  if (interlocutor !== 'tenant') return acknowledgment;

  const earlyTurn =
    state === 'ASK_ONE_QUESTION' ||
    state === 'NEED_PHOTO' ||
    state === 'WAITING_TENANT';
  if (earlyTurn) return acknowledgment;

  let ack = appendPrevenirVoisinDessus(
    acknowledgment,
    inputs.head3.originFromAbove,
  );

  const sinistreTrack =
    inputs.head3.sinistre_probable || inputs.head4.sinistre_candidat;
  if (!sinistreTrack) return ack;

  const missing: string[] = [];
  if (!mentionsSecurite(ack)) missing.push('sécurité');
  if (!mentionsPhoto(ack)) missing.push('photos/preuves');
  if (!mentionsAssurance(ack)) missing.push('assurance');

  if (missing.length === 0) return ack;

  return appendSentence(ack, SUPPLEMENT_SINISTRE_THEMES);
}

export function supplementPrevenirVoisinDessus(
  acknowledgment: string,
  originFromAbove: boolean,
  interlocutor: GrockInterlocutor,
): string {
  if (interlocutor !== 'tenant') return acknowledgment;
  return appendPrevenirVoisinDessus(acknowledgment, originFromAbove);
}
