/**
 * Extraction 360° plomberie — Rigueur Marie / mode Jarvis.
 */
import { parseOccupancyContext } from '../../chercheur/knowledge/lia-occupancy-context';
import type { IntakeSignals } from './lia-intake.service';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export interface PlumbingIntakeExtraction {
  answers: Record<string, string>;
  skippedQuestionIds: string[];
  jarvisFacts: Record<string, string>;
  roomHint?: string;
  newTenant: boolean;
  underFixtureLeak: boolean;
}

export function extractPlumbingIntakeFromText(
  title: string,
  description: string,
  extraMessage = '',
): PlumbingIntakeExtraction {
  const full = `${title} ${description} ${extraMessage}`.trim();
  const t = norm(full);
  const answers: Record<string, string> = {};
  const jarvisFacts: Record<string, string> = {};
  const skipped = new Set<string>();

  const underFixtureLeak =
    /sous.*(evier|évier|lavabo)|fuite.*(dessous|sous|endessous)|endessous|dessous.*(evier|évier)|fuit.*(evier|évier|lavabo)|(evier|évier).*(fuit|coule)/.test(
      t,
    );

  if (underFixtureLeak) {
    jarvisFacts.localisation = 'Évier / sous l’évier';
    jarvisFacts.type_panne = 'Fuite localisée sous équipement';
    answers.drain_ok =
      'Fuite sous l’évier — pas une colonne ni plafond (déjà précisé).';
    answers.siphon_action =
      answers.siphon_action ??
      'À préciser si débouchage déjà tenté (non mentionné).';
    skipped.add('when_rains');
    skipped.add('org:cause_colonne_collective');
  }

  if (/evier|évier/.test(t)) {
    jarvisFacts.equipement = 'Évier';
  }
  if (/\bwc\b|toilet/.test(t)) {
    jarvisFacts.equipement = 'WC';
  }

  const occ = parseOccupancyContext(full);
  const newTenant =
    occ.withinSixMonthsOfMoveIn ||
    occ.problemSinceMoveIn ||
    /emmenag/.test(t) ||
    /\b(nouveau locataire|entree dans le logement|viens d.?emmenager)\b/.test(
      t,
    );

  if (newTenant) {
    jarvisFacts.nouveau_locataire = 'Oui';
    answers.occupancy_note = 'Nouveau locataire / entrée récente.';
  }

  if (/depuis|semaine|hier|matin|jour|mois|aujourd/.test(t)) {
    answers.since_when = 'Durée déjà indiquée dans le signalement.';
    skipped.add('since_when');
  }

  if (/plombier|reparer|reparer|intervenir/.test(t)) {
    jarvisFacts.demande_intervention = 'Oui';
  }

  let roomHint: string | undefined;
  if (/cuisine/.test(t)) roomHint = 'cuisine';
  else if (/evier|évier/.test(t)) roomHint = 'évier';

  return {
    answers,
    skippedQuestionIds: [...skipped],
    jarvisFacts,
    roomHint,
    newTenant,
    underFixtureLeak,
  };
}

export function isPlumbingSinkLeakSaturated(
  state: {
    answers: Record<string, string>;
    signals?: IntakeSignals;
    intakeTitle?: string;
    intakeDescription?: string;
    jarvisFacts?: Record<string, string>;
  },
): boolean {
  const ctx = [
    state.intakeTitle ?? '',
    state.intakeDescription ?? '',
    ...Object.values(state.answers),
    ...Object.values(state.jarvisFacts ?? {}),
  ].join(' ');

  const ex = extractPlumbingIntakeFromText(
    state.intakeTitle ?? '',
    state.intakeDescription ?? '',
  );
  return ex.underFixtureLeak && /evier|évier/.test(norm(ctx));
}
