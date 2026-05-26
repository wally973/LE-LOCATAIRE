/**
 * Extraction 360° menuiserie / serrurerie — gâche, serrure, porte (mode Jarvis).
 */
import type { IntakeSignals } from './lia-intake.service';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export interface CarpentryIntakeExtraction {
  answers: Record<string, string>;
  skippedQuestionIds: string[];
  jarvisFacts: Record<string, string>;
  roomHint?: string;
}

/** Signalement porte / serrure / gâche (intérieur ou palière). */
export function isCarpentryDoorIssueText(text: string): boolean {
  const t = norm(text);
  const doorHardware =
    /gache|gâche|serrure|poignee|poignée|targette|verrou|cremone|crémone|penture/.test(
      t,
    );
  const doorContext = /porte|chambre|piece|pièce|entree|entrée|palier/.test(t);
  const damage =
    /(cass|cassé|cassee|bloqu|ferme pas|ne ferme|coinc|hs|arrach)/.test(t);
  return (doorHardware && doorContext) || (doorHardware && damage);
}

function extractRoomHint(t: string): string | undefined {
  const chambreFils = t.match(
    /chambre\s+(?:de\s+)?(?:mon|ma|mes|ton|ta|le|la|l')\s+\w+/,
  );
  if (chambreFils) return chambreFils[0].trim();
  const chambre = t.match(/chambre(?:\s+\w+){0,3}/);
  if (chambre) return chambre[0].trim();
  if (/cuisine/.test(t)) return 'cuisine';
  if (/salon/.test(t)) return 'salon';
  if (/salle de bain/.test(t)) return 'salle de bain';
  if (/couloir/.test(t)) return 'couloir';
  if (/entree|entrée/.test(t)) return 'entrée';
  return undefined;
}

function extractElementLabel(t: string): string {
  if (/gache|gâche/.test(t)) return 'Gâche de porte';
  if (/serrure/.test(t)) return 'Serrure';
  if (/poignee|poignée/.test(t)) return 'Poignée';
  if (/targette/.test(t)) return 'Targette';
  return 'Porte / fermeture';
}

export function extractCarpentryIntakeFromText(
  title: string,
  description: string,
  extraMessage = '',
): CarpentryIntakeExtraction {
  const full = `${title} ${description} ${extraMessage}`.trim();
  const t = norm(full);
  const answers: Record<string, string> = {};
  const jarvisFacts: Record<string, string> = {};
  const skipped = new Set<string>();

  if (!isCarpentryDoorIssueText(full)) {
    return {
      answers,
      skippedQuestionIds: [],
      jarvisFacts,
    };
  }

  jarvisFacts.element = extractElementLabel(t);
  jarvisFacts.type_panne = 'Menuiserie / serrurerie';

  const roomHint = extractRoomHint(t);
  if (roomHint) {
    jarvisFacts.localisation = roomHint;
    answers.location_detail = `Déjà précisé : ${roomHint}.`;
    skipped.add('location_detail');
  }

  if (/(cass|cassé|cassee|arrach|hs|bloqu|ne ferme|coinc)/.test(t)) {
    jarvisFacts.dommage = 'Élément cassé ou défectueux';
    answers.worsening =
      'Dommage constaté (cassé / HS) — pas une aggravation progressive.';
    skipped.add('worsening');
  }

  if (/matin|hier|depuis|semaine|aujourd|jour|mois|ce matin|la semaine/.test(t)) {
    answers.since_when = 'Durée ou moment déjà indiqué dans le signalement.';
    skipped.add('since_when');
  }

  if (/porte d.?entr|palier|partie commune/.test(t)) {
    jarvisFacts.porte_type = 'Porte palière / entrée';
  } else if (/chambre|piece|pièce|cuisine|salon/.test(t)) {
    jarvisFacts.porte_type = 'Porte intérieure logement';
  }

  return {
    answers,
    skippedQuestionIds: [...skipped],
    jarvisFacts,
    roomHint,
  };
}

export function isCarpentryDoorIssueSaturated(state: {
  answers: Record<string, string>;
  signals?: IntakeSignals;
  intakeTitle?: string;
  intakeDescription?: string;
  jarvisFacts?: Record<string, string>;
}): boolean {
  const ctx = [
    state.intakeTitle ?? '',
    state.intakeDescription ?? '',
    ...Object.values(state.answers),
    ...Object.values(state.jarvisFacts ?? {}),
  ].join(' ');

  if (!isCarpentryDoorIssueText(ctx)) return false;

  const ex = extractCarpentryIntakeFromText(
    state.intakeTitle ?? '',
    state.intakeDescription ?? '',
  );
  const hasLocation =
    Boolean(ex.jarvisFacts.localisation) ||
    Boolean(state.signals?.roomHint) ||
    /chambre|piece|pièce|cuisine|salon|entree|entrée/.test(norm(ctx));
  const hasDamage =
    Boolean(ex.jarvisFacts.dommage) ||
    /(cass|cassé|cassee|bloqu|hs)/.test(norm(ctx));

  return hasLocation && hasDamage;
}

/** Reformulation Expert de poche après prise en compte (menuiserie). */
export function buildCarpentryExpertAcknowledgment(params: {
  title: string;
  description: string;
  answers: Record<string, string>;
  jarvisFacts?: Record<string, string>;
  tenantFirstName?: string;
}): string {
  const name = params.tenantFirstName?.trim() || 'Bonjour';
  const full = `${params.title} ${params.description}`;
  const ex = extractCarpentryIntakeFromText(
    params.title,
    params.description,
  );
  const facts = { ...ex.jarvisFacts, ...params.jarvisFacts };
  const element = facts.element ?? 'la fermeture de porte';
  const lieu = facts.localisation ?? params.answers.location_detail ?? 'le logement';
  const lieuCourt = lieu.replace(/^Déjà précisé\s*:\s*/i, '').replace(/\.$/, '');

  return (
    `${name}, oui — j’ai bien compris : ${element.toLowerCase()} ` +
    `dans ${lieuCourt} est cassée. Je transmets l’alerte au bailleur pour qu’un serrurier intervienne. ` +
    'La porte ferme-t-elle encore, ou est-elle complètement bloquée ?'
  );
}
