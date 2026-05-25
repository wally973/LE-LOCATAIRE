/**
 * Rigueur Marie — écoute réelle du premier message (électricité / éclairage).
 */
import { parseOccupancyContext } from '../../chercheur/knowledge/lia-occupancy-context';
import {
  parseElectricitySignals,
  parseElectricitySignalsFromAnswers,
  resolveElectricityCharge,
  type ElectricityCharge,
} from '../../diagnostiqueur/rules/lia-electricity-rules';
import type { IntakeSignals, LiaIntakeState } from './lia-intake.service';
import {
  isLightingOnlyScope,
  tenantAlreadyChangedBulb,
} from './lia-intake.service';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function triState(fragment: string): boolean | null {
  const t = norm(fragment);
  if (!t.trim()) return null;
  if (/\b(non|pas|ne marche|ne fonctionne|inutilisable|declench|saute)\b/.test(t)) {
    if (/\b(oui|fonctionne|marche|enclench)\b/.test(t) && /\b(pas|non)\b/.test(t)) {
      return false;
    }
    return false;
  }
  if (/\b(oui|ok|fonctionne|marche|enclench|verifi|deja|déjà)\b/.test(t)) {
    return true;
  }
  return null;
}

export interface ElectricityIntakeExtraction {
  answers: Record<string, string>;
  skippedQuestionIds: string[];
  roomHint?: string;
  newTenant: boolean;
}

/** Extrait ampoule, compteur/disjoncteur, interrupteur, douille, durée depuis le texte complet. */
export function extractElectricityIntakeFromText(
  title: string,
  description: string,
  extraMessage = '',
): ElectricityIntakeExtraction {
  const full = `${title} ${description} ${extraMessage}`.trim();
  const t = norm(full);
  const answers: Record<string, string> = {};
  const skipped = new Set<string>();

  const roomHint = extractRoomFromText(full);
  const signals: IntakeSignals = roomHint ? { roomHint } : {};
  const lighting = isLightingOnlyScope(full, signals, answers);

  if (lighting) {
    answers.scope =
      'Éclairage localisé (point lumineux, pas coupure générale).';
    skipped.add('breaker');
    skipped.add('breaker_stays');
    skipped.add('subscription');
  }

  if (tenantAlreadyChangedBulb(full, answers)) {
    answers.bulb_action =
      'Ampoule déjà remplacée ou testée (mentionnée dans le signalement).';
  }

  if (/depuis|emménag|entree|entrée|mois|semaine|hier|matin|jour|aujourd/.test(t)) {
    answers.since_when =
      'Durée ou contexte déjà indiqué à l’ouverture du dossier.';
    skipped.add('since_when');
  }

  if (/(interrupteur|marche.?arr[eê]t)/.test(t)) {
    const sw = triState(
      full.match(/interrupteur[^.!\n]{0,80}/i)?.[0] ?? full,
    );
    if (sw === true) {
      answers.switch_ok =
        'Oui — interrupteur testé (déjà indiqué dans le signalement).';
      skipped.add('switch_ok');
    } else if (sw === false) {
      answers.switch_ok =
        'Non — interrupteur ne fonctionne pas (déjà indiqué).';
      skipped.add('switch_ok');
    }
  }

  if (/(disjoncteur|compteur|tableau)/.test(t)) {
    const breakerFrag =
      full.match(/(?:disjoncteur|compteur|tableau)[^.!\n]{0,100}/i)?.[0] ??
      full;
    const br = triState(breakerFrag);
    if (br === true) {
      answers.room_breaker =
        'Oui — compteur ou disjoncteur déjà vérifié (mention initiale).';
      skipped.add('room_breaker');
    } else if (br === false) {
      answers.room_breaker =
        'Non — disjoncteur reste déclenché ou circuit coupé (mention initiale).';
      skipped.add('room_breaker');
    } else if (/(verifi|control|deja|déjà|enclench|remis)/.test(t)) {
      answers.room_breaker =
        'Oui — vérification déjà faite (compteur / tableau mentionné).';
      skipped.add('room_breaker');
    }
  }

  if (/(douille|support|culot)/.test(t)) {
    const douille = triState(
      full.match(/(?:douille|support|culot)[^.!\n]{0,80}/i)?.[0] ?? full,
    );
    if (douille === true) {
      answers.socket_check =
        'Oui — usure ou anomalie sur la douille (déjà décrite).';
      skipped.add('socket_check');
    } else if (douille === false) {
      answers.socket_check =
        'Non — pas d’anomalie visible sur la douille (déjà indiqué).';
      skipped.add('socket_check');
    }
  } else if (
    /(pas d.?usure|rien de visible|douille (ok|normale)|support (ok|normal))/.test(
      t,
    )
  ) {
    answers.socket_check =
      'Non — pas d’anomalie visible (déjà indiqué).';
    skipped.add('socket_check');
  }

  const occ = parseOccupancyContext(full);
  const newTenant =
    occ.withinSixMonthsOfMoveIn ||
    occ.problemSinceMoveIn ||
    /emmenag/.test(t) ||
    /\b(nouveau locataire|depuis mon entree|depuis l.?emmenagement|premiers jours)\b/.test(
      t,
    );

  if (newTenant) {
    answers.occupancy_note =
      'Nouveau locataire / entrée récente dans le logement.';
  }

  return {
    answers,
    skippedQuestionIds: [...skipped],
    roomHint,
    newTenant,
  };
}

function extractRoomFromText(text: string): string | undefined {
  const patterns = [
    /\bchambre\b/i,
    /\bsalle de bain\b/i,
    /\bcuisine\b/i,
    /\bsalon\b/i,
  ];
  for (const p of patterns) {
    if (p.test(text)) {
      const m = text.match(p);
      return m?.[0]?.trim();
    }
  }
  return undefined;
}

/** Fusionne l’extraction dans l’état intake puis recalcule les questions restantes. */
export function applyElectricityExtractionToState(
  state: LiaIntakeState,
  title: string,
  description: string,
  message = '',
): LiaIntakeState {
  if (state.category !== 'ELECTRICITY') {
    return state;
  }

  const extracted = extractElectricityIntakeFromText(
    title,
    description,
    message,
  );
  const skipped = new Set([
    ...(state.skippedQuestionIds ?? []),
    ...extracted.skippedQuestionIds,
  ]);

  const answers = { ...state.answers, ...extracted.answers };
  let signals = { ...state.signals };
  if (extracted.roomHint) {
    signals = { ...signals, roomHint: extracted.roomHint };
  }

  return {
    ...state,
    answers,
    skippedQuestionIds: [...skipped],
    signals,
  };
}

/** Photo utile uniquement si la douille n’est pas encore qualifiée et qu’une preuve visuelle est pertinente. */
export function needsContextualElectricityPhoto(state: LiaIntakeState): boolean {
  const ctx = [
    state.intakeTitle ?? '',
    state.intakeDescription ?? '',
    ...Object.values(state.answers),
  ].join(' ');

  if (!isLightingOnlyScope(ctx, state.signals, state.answers)) {
    return false;
  }

  if (state.answers.socket_check?.trim()) {
    return false;
  }

  const signals = parseElectricitySignals(ctx);
  if (
    signals.bulbAlreadyChanged &&
    signals.switchWorks != null &&
    signals.roomBreakerOk != null
  ) {
    return false;
  }

  return /douille|support|culot|brun|odeur|grésill/i.test(ctx);
}

/** Tous les faits critiques éclairage sont couverts — intake peut passer en DONE sans photo générique. */
export function isElectricityLightingIntakeSaturated(
  state: LiaIntakeState,
): boolean {
  const ctx = [
    state.intakeTitle ?? '',
    state.intakeDescription ?? '',
    ...Object.values(state.answers),
  ].join(' ');

  if (!isLightingOnlyScope(ctx, state.signals, state.answers)) {
    return false;
  }

  const signals = parseElectricitySignalsFromAnswers(state.answers, ctx);

  if (signals.bulbAlreadyChanged && signals.roomBreakerOk === true) {
    return true;
  }

  return (
    signals.bulbAlreadyChanged &&
    signals.switchWorks != null &&
    signals.roomBreakerOk != null &&
    (signals.douilleWear != null || Boolean(state.answers.socket_check?.trim()))
  );
}

/** Message d’accueil intelligent (nouveau locataire + faits déjà donnés). */
export function buildMarieElectricityAcknowledgment(params: {
  title: string;
  description: string;
  answers: Record<string, string>;
  tenantFirstName?: string;
}): string {
  const ctx = [
    params.title,
    params.description,
    ...Object.values(params.answers),
  ].join(' ');
  const signals = parseElectricitySignals(ctx);
  const occ = parseOccupancyContext(ctx);
  const charge: ElectricityCharge | null = resolveElectricityCharge(signals, ctx);
  const name = params.tenantFirstName?.trim() || 'Bonjour';

  const verified: string[] = [];
  if (signals.bulbAlreadyChanged) verified.push('l’ampoule');
  if (signals.roomBreakerOk === true || /compteur|disjoncteur/.test(norm(ctx))) {
    verified.push('le compteur et le disjoncteur');
  }
  if (signals.switchWorks === false) verified.push('l’interrupteur');

  const verifiedPhrase =
    verified.length > 0
      ? `vous avez déjà vérifié ${verified.join(', ')}`
      : 'vous avez déjà donné les éléments utiles';

  const newTenant =
    occ.withinSixMonthsOfMoveIn ||
    signals.recentMoveIn ||
    signals.problemSinceMoveIn ||
    Boolean(params.answers.occupancy_note) ||
    /\b(viens d.?emmen|je viens d.?emmen)\b/.test(norm(ctx));

  if (newTenant && charge === 'BAILLEUR') {
    return (
      `${name}, je comprends : ${verifiedPhrase}. ` +
      'Comme vous venez d’emménager, le problème vient probablement du circuit interne ou de la remise en état — ce n’est pas une simple ampoule à votre charge. ' +
      'Je lance l’analyse et vous recevrez le verdict détaillé (charge bailleur).'
    );
  }

  if (newTenant) {
    return (
      `${name}, je comprends : ${verifiedPhrase}. ` +
      'Comme vous venez d’emménager, je ne vais pas vous faire répéter des vérifications déjà faites — je lance le diagnostic tout de suite.'
    );
  }

  if (charge === 'BAILLEUR') {
    return (
      `${name}, je comprends : ${verifiedPhrase}. ` +
      'Le diagnostic pointe vers une intervention du bailleur (installation ou circuit). Je lance l’analyse complète.'
    );
  }

  if (charge === 'LOCATAIRE') {
    return (
      `${name}, je comprends : ${verifiedPhrase}. ` +
      'Après ces vérifications, il reste une menue réparation locative probable — je lance l’analyse.'
    );
  }

  return (
    `${name}, je comprends : ${verifiedPhrase}. ` +
    'Je n’ai pas besoin de vous refaire les mêmes questions — je lance le diagnostic.'
  );
}
