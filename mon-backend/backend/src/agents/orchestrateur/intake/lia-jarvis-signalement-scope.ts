/**
 * Périmètre signalement Jarvis — veto de lot et anti-pollution entre dossiers.
 */
export type JarvisSignalementLot =
  | 'ELECTRICITY'
  | 'PLUMBING'
  | 'CARPENTRY'
  | 'ROOF'
  | 'GENERIC';

function norm(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Prise TV / HDMI — pas le lot électricité sécurité. */
export function isTvOrSignalPriseContext(ctx: string): boolean {
  return /\btv\b|television|t[eé]l[eé]vision|hdmi|decodeur|d[eé]codeur|antenne|box|chaine|canal|r[eé]ception|signal/.test(
    ctx,
  );
}

/** Prise murale / arc / grésillement — veto électrique (priorité sur clés, eau, générique). */
export function isElectricalOutletSignalement(ctx: string): boolean {
  const t = norm(ctx);
  if (isTvOrSignalPriseContext(t)) return false;
  if (
    /grésill|gresill|étincell|etincell|arc elect|odeur de brul|odeur de brûl|plastique brul|plastique brûl|sent le brul|sent le brûl|ca sent|ça sent/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bprise\b/.test(t) && /buanderie|buandrie|laverie/.test(t)) {
    return true;
  }
  if (/\bprise\b/.test(t) && /electri|secteur|disjoncteur|tableau|courant|grésill|gresill/.test(t)) {
    return true;
  }
  if (/grésill|gresill/.test(t)) return true;
  return /\bprise\b/.test(t) && !/perdu|oublie|clef|cl[eé]|serrur|portail|boite aux lettres/.test(t);
}

export function classifyJarvisSignalementLot(ctx: string): JarvisSignalementLot {
  const t = norm(ctx);
  if (isElectricalOutletSignalement(t)) return 'ELECTRICITY';
  if (
    (/bloqu|coinc|ne s.?ouvre plus/.test(t) &&
      /enfant|fils|fille|bebe|dedans|enferm|dans la chambre|dans la piece|dans la pièce/.test(
        t,
      )) ||
    (/porte/.test(t) &&
      /(ferme pas|ne ferme|coinc|bloqu|accroch|frotte|gonfl|affaiss)/.test(t)) ||
    (/gache|gâche|serrure|poignee|poignée|penture|targette|verrou|cremone|crémone/.test(t) &&
      /porte|entree|entrée|chambre/.test(t)) ||
    (/perdu.*cl|cl[eé]s?.*perdu|perdus.*cl|perdu.*clef|clef.*perdu|oublie.*cl|cl.*oublie|sans cl[eé]/.test(
      t,
    ) &&
      !isElectricalOutletSignalement(t))
  ) {
    return 'CARPENTRY';
  }
    if (
      /fuite|eau|coule|goutte|plomb|evier|évier|lavabo|siphon|flexible|robinet|dlo|bokit|puisage|mitigeur/.test(
        t,
      ) &&
      !/moisiss|humidit|salp[eè]tre|enveloppe|[eé]tanch[eé]it/.test(t) &&
      !isElectricalOutletSignalement(t)
    ) {
      return 'PLUMBING';
    }
  if (
    /toit|toiture|infiltr|plafond|goutti|facade|façade|pluie|moisiss|humidit|salp[eè]tre|enveloppe|[eé]tanch[eé]it/.test(
      t,
    )
  ) {
    return 'ROOF';
  }
  const broadElectric =
    /electri|disjoncteur|compteur|courant|ampoule|lustre|plafonnier|néon|neon|éclairage|eclairage/.test(
      t,
    );
  if (
    broadElectric &&
    !(isTvOrSignalPriseContext(t) && !isElectricalOutletSignalement(t))
  ) {
    return 'ELECTRICITY';
  }
  return 'GENERIC';
}

export function shouldApplyLostKeysContext(ctx: string): boolean {
  if (isElectricalOutletSignalement(ctx)) return false;
  return /perdu.*cl|cl[eé]s?.*perdu|perdus.*cl|perdu.*clef|clef.*perdu|oublie.*cl|cl.*oublie|sans cl[eé]/.test(
    norm(ctx),
  );
}

/** Retire l’ack précédent si le fil métier a changé (ex. clés → prise). */
export function sanitizePriorAcknowledgmentForSignalement(
  priorAcknowledgment: string | undefined,
  title: string,
  description: string,
  message: string,
): string | undefined {
  const prior = priorAcknowledgment?.trim();
  if (!prior) return undefined;
  const ctx = norm(`${title} ${description} ${message}`);
  const ack = norm(prior);
  const electricalNow = isElectricalOutletSignalement(ctx);
  const keysPrior =
    /perdu.*cl|cl[eé].*perdu|serrurier|clef.*perdu|oublie.*cl|charge locataire.*cl/.test(ack);
  const plumbingPrior = /robinet|puisage|joint|plombier|exutoire|évacuation|evacuation/.test(ack);
  const electricalPrior = /grésill|gresill|prise|disjoncteur|ampoule|électri|electri/.test(ack);

  if (electricalNow && (keysPrior || (plumbingPrior && !electricalPrior))) {
    return undefined;
  }
  if (
    classifyJarvisSignalementLot(ctx) === 'PLUMBING' &&
    keysPrior &&
    !plumbingPrior
  ) {
    return undefined;
  }
  if (
    classifyJarvisSignalementLot(ctx) === 'CARPENTRY' &&
    (electricalPrior || plumbingPrior) &&
    !keysPrior
  ) {
    return undefined;
  }
  return prior;
}

export function mentionsExutoireOrWaterMentalModel(text: string): boolean {
  const t = norm(text);
  return /exutoire|refoul|évacuation|evacuation|siphon|bonde|dalle froide|colonne eu|stagnation/.test(
    t,
  );
}

export function isBulbOrLightingProbeQuestion(question: string): boolean {
  const t = norm(question);
  return /ampoule|douille|lustre|plafonnier|néon|neon|culot/.test(t) && !/prise murale|secteur/.test(t);
}

/** Le locataire a déjà décrit un danger électrique immédiat — ne pas redemander odeur / appareil. */
export function tenantAlreadyDescribedElectricalHazard(ctx: string): boolean {
  const t = norm(ctx);
  if (!/\bprise\b|electri|disjoncteur|socle/.test(t)) return false;
  return (
    /étincell|etincell|grésill|gresill|plastique brul|odeur de brul|sent le brul|ca sent|ça sent|fumée|fumee|noirc/.test(
      t,
    ) ||
    /arrach|arrache|d[eé]nud|fils? (a |à )?nu|fils apparent|socle.*cass|prise.*cass|cass[eé].*prise|boitier.*arrach|sortie.*mur/.test(
      t,
    )
  );
}

/** Sonde « appareil branché / odeur » inutile après signalement complet. */
export function isRedundantElectricalOutletProbe(question: string, signalementText: string): boolean {
  const q = norm(question);
  if (!tenantAlreadyDescribedElectricalHazard(signalementText)) return false;
  return (
    /appareil branch|branché sur cette prise|odeur de brul|odeur de brûl|sentez-vous une odeur/.test(
      q,
    ) || isBulbOrLightingProbeQuestion(question)
  );
}
