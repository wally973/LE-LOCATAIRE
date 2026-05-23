/**
 * Règles métier électricité / éclairage (intake + texte signalement).
 * Utilisé par le juriste et les messages locataire.
 */

export function normalizeForElectricityRules(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export interface ElectricitySignals {
  localizedLighting: boolean;
  bulbAlreadyChanged: boolean;
  generalOutage: boolean;
  switchWorks: boolean | null;
  roomBreakerOk: boolean | null;
  douilleWear: boolean | null;
  bailleurInstallation: boolean;
}

function triStateFromAnswer(fragment: string): boolean | null {
  const t = normalizeForElectricityRules(fragment);
  if (!t.trim()) return null;
  if (
    /^(oui|yes|ok)\b/.test(t) ||
    /\b(oui|fonctionne|marche|enclench|remis|bien)\b/.test(t)
  ) {
    if (
      /\b(non|pas|ne fonctionne|ne marche|declench|saute|tient pas|odeur)\b/.test(
        t,
      )
    ) {
      if (/\b(oui|fonctionne|marche|enclench)\b/.test(t)) {
        return !/\b(pas|non|ne)\b/.test(t.split(/\b(oui|fonctionne)\b/)[0] ?? '');
      }
      return false;
    }
    return true;
  }
  if (
    /\b(non|pas|ne fonctionne|ne marche|declench|saute|tient pas|inutilisable)\b/.test(
      t,
    )
  ) {
    return false;
  }
  return null;
}

function extractAnswerBlock(text: string, label: string): string {
  const re = new RegExp(
    `${label}[^→]*→\\s*([^\\n]+)`,
    'i',
  );
  const m = text.match(re);
  return m?.[1]?.trim() ?? '';
}

export function parseElectricitySignals(text: string): ElectricitySignals {
  const t = normalizeForElectricityRules(text);

  const generalOutage =
    /\b(tout le logement|toute la maison|plus de courant|plus d.?electricite|coupure generale)\b/.test(
      t,
    ) && !/\b(localise|une seule piece|salle de bain)\b/.test(t);

  const localizedLighting =
    !generalOutage &&
    (/\b(localise|une seule piece)\b/.test(t) ||
      (/\b(lumiere|ampoule|eclairage|lustre|plafonnier|neon)\b/.test(t) &&
        !generalOutage) ||
      /\b(salle de bain|sdb).*(lumi|ampoule|eclair)/.test(t) ||
      /\b(lumi|ampoule).*(salle de bain|sdb)\b/.test(t));

  const bulbAlreadyChanged =
    /\b(ampoule|ampoules).*(chang|remplac|deja|essay|neuf|malgre)/.test(t) ||
    /\b(deja chang|j.?ai chang).*(ampoule)\b/.test(t) ||
    /bulb_action/i.test(text);

  const switchBlock = extractAnswerBlock(text, 'interrupteur');
  const switchWorks = switchBlock ? triStateFromAnswer(switchBlock) : null;

  const breakerBlock = extractAnswerBlock(text, 'disjoncteur');
  const roomBreakerOk = breakerBlock ? triStateFromAnswer(breakerBlock) : null;

  const douilleBlock =
    extractAnswerBlock(text, 'douille') || extractAnswerBlock(text, 'support');
  const douilleWear = douilleBlock
    ? triStateFromAnswer(douilleBlock)
    : /\b(douille|support).*(usure|brun|odeur|jeu)\b/.test(t)
      ? true
      : null;

  const bailleurInstallation =
    /\b(tableau electrique|cablage encastr|fils denud|installation endommage|odeur de brul|etincelle)\b/.test(
      t,
    ) ||
    (roomBreakerOk === false &&
      /\b(ne tient pas|resaute|reste declench)\b/.test(t));

  return {
    localizedLighting,
    bulbAlreadyChanged,
    generalOutage,
    switchWorks,
    roomBreakerOk,
    douilleWear,
    bailleurInstallation,
  };
}

export type ElectricityCharge = 'BAILLEUR' | 'LOCATAIRE' | 'ESCALADE_BAILLEUR';

/** Tranche la responsabilité électricité ; null = laisser les règles génériques. */
export function resolveElectricityCharge(
  signals: ElectricitySignals,
): ElectricityCharge | null {
  if (signals.bailleurInstallation || signals.generalOutage) {
    return 'BAILLEUR';
  }

  if (!signals.localizedLighting) {
    return null;
  }

  if (signals.roomBreakerOk === false) {
    return 'BAILLEUR';
  }

  if (signals.bulbAlreadyChanged) {
    if (signals.switchWorks === false) {
      return 'LOCATAIRE';
    }
    if (signals.douilleWear === true) {
      return 'LOCATAIRE';
    }
    if (signals.switchWorks === true && signals.roomBreakerOk === true) {
      return 'ESCALADE_BAILLEUR';
    }
  }

  if (signals.localizedLighting && !signals.bulbAlreadyChanged) {
    return 'LOCATAIRE';
  }

  return null;
}

/** Signaux à partir des champs intake structurés (évite les faux « oui » croisés). */
export function parseElectricitySignalsFromAnswers(
  answers: Record<string, string>,
): ElectricitySignals {
  const scopeText = answers.scope ?? '';
  const localized =
    /localis/i.test(scopeText) ||
    parseElectricitySignals(scopeText).localizedLighting;
  return {
    localizedLighting: localized,
    bulbAlreadyChanged: Boolean(answers.bulb_action?.trim()),
    generalOutage: /tout le logement|toute la maison|coupure g[eé]n[eé]rale/i.test(
      scopeText,
    ),
    switchWorks: triStateFromAnswer(answers.switch_ok ?? ''),
    roomBreakerOk: triStateFromAnswer(answers.room_breaker ?? ''),
    douilleWear: triStateFromAnswer(answers.socket_check ?? ''),
    bailleurInstallation: triStateFromAnswer(answers.room_breaker ?? '') === false,
  };
}

/** Indice court pour le résumé intake → juriste / RAG. */
export function buildElectricityJuristHint(answers: Record<string, string>): string {
  const parts: string[] = [];
  if (answers.bulb_action) {
    parts.push(`Ampoule : ${answers.bulb_action}`);
  }
  if (answers.switch_ok) {
    parts.push(`Interrupteur : ${answers.switch_ok}`);
  }
  if (answers.room_breaker) {
    parts.push(`Disjoncteur circuit : ${answers.room_breaker}`);
  }
  if (answers.socket_check) {
    parts.push(`Douille/support : ${answers.socket_check}`);
  }
  if (answers.scope) {
    parts.push(`Périmètre : ${answers.scope}`);
  }
  if (parts.length === 0) return '';
  const signals = parseElectricitySignalsFromAnswers(answers);
  const charge = resolveElectricityCharge(signals);
  const orient =
    charge === 'BAILLEUR'
      ? 'charge bailleur probable'
      : charge === 'LOCATAIRE'
        ? 'réparation locative probable'
        : charge === 'ESCALADE_BAILLEUR'
          ? 'qualification incertaine — agent bailleur'
          : 'à trancher avec FAQ électricité';
  return `Orientation juriste (éclairage) : ${orient}. ${parts.join(' ; ')}.`;
}
