/**
 * Couche d’écoute — faits extraits du signalement locataire (titre + description + fil).
 * Une seule vérité partagée : locataire, technicien, bailleur (SharedState / jarvisFacts).
 * Règles générales — pas une fiche JSON par sujet.
 */
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import { normClinicalText } from './lia-text-normalize';

export type TenantLocationScope = 'logement' | 'communs' | 'both' | 'unknown';

/** Équipement / sujet réel du signalement (message locataire prime sur le titre). */
export type TenantEquipmentSubject = 'portail' | 'mailbox' | null;

export interface TenantSignalementFacts {
  locationScope: TenantLocationScope;
  /** Lieux communs cités explicitement (hall, escalier…). */
  commonAreasMentioned: string[];
  logementMentioned: boolean;
  /** Salubrité / propreté (souvent parties communes). */
  salubriteIssue: boolean;
  /** Hall / escalier / communs explicitement affirmés (partagés), pas seulement mentionnés. */
  communsAffirmed: boolean;
  /** Périmètre géographique déjà clair — ne pas re-sonder logement vs communs. */
  perimeterResolved: boolean;
  /** Hall / escalier + salubrité : fil métier ménage communs. */
  commonsSalubrityLead: boolean;
  /** Délai ou relance déjà évoqués. */
  priorLandlordContact: boolean;
  equipmentSubject: TenantEquipmentSubject;
  /** Le locataire a corrigé le sujet (ex. « je parle du portail », pas boîte aux lettres). */
  subjectCorrected: boolean;
  /** Personne enfermée / bloquée derrière la porte — priorité sécurité. */
  safetyUrgent: boolean;
  /** Panne mécanique porte / serrure / poignée (fil diagnostic). */
  mechanicalDoorIssue: boolean;
  /** Accueil, document, interlocuteur — hors intake technique. */
  administrativeLead: boolean;
  /** Fuite / inondation — locataire signale l'urgence. */
  plumbingUrgent: boolean;
  /** Cuisine ou pièce humide inondée / évier débordant. */
  plumbingFlooding: boolean;
  /** Refoulement évacuation — évier plein, eau sale, pièce inondée (pas fuite amont). */
  plumbingBackupLead: boolean;
  /** Refoulement EU colonne — exutoire aval (3 verres), intervention hydrocureur. */
  plumbingEuRefoulementLead: boolean;
}

const COMMON_AREA_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bhall\b|hall d.?entree|hall d.?entrée/, label: 'hall' },
  { pattern: /\bescalier|cage d.?escalier|cage d'escalier/, label: 'escalier' },
  { pattern: /partie[s]? commune[s]?|parties communes/, label: 'parties communes' },
  { pattern: /\bcouloir\b/, label: 'couloir' },
  { pattern: /\bpalier\b/, label: 'palier' },
  { pattern: /local poubelle|local [aà] poubelle/, label: 'local poubelles' },
];

const LOGEMENT_PATTERNS =
  /mon appart|mon logement|chez moi|dans ma chambre|dans ma cuisine|dans mon salon|dans ma sdb|dans le logement|mon lot|ma porte d.?entree|ma porte d.?entrée|0?4\b.*appart/i;

const SALUBRITE_PATTERNS =
  /insalubre|\bhall sale\b|\bescalier sale\b|\best sale\b|\bsales\b|saliss|crasse|degeu|salete|salet|proprete|propreté|menage|ménage|nettoyage|salubrit|odeur|poubelle|poussiere|poussière|dechets|déchets|pas nettoy|n.?est pas nettoy|n.?est plus nettoy/i;

const PLUMBING_DIRTY_WATER_CTX = /eau\s+sale|eaux\s+sales|eau\s+crasse|evier.*sale|évier.*sale/i;

const PRIOR_CONTACT_PATTERNS =
  /deja ecrit|déjà écrit|deja signale|déjà signal|sans reponse|sans réponse|relance|accuse reception|accusé réception|(?:mail|e.?mail|telephone|téléphone|courrier).{0,50}(?:bailleur|ecrit|signale|reponse|réponse)|(?:ecrit|signale|contacte).{0,50}(?:bailleur|mail|reponse|réponse)/i;

const PORTAIL_PATTERNS = /portail|parking|barriere|barrière|pòtay/;
const MAILBOX_PATTERNS = /boite aux lettres|boite a lettres|boîte aux lettres|boite|lettre|courrier|bwat let|bwat lèt/;

function detectSafetyUrgent(ctx: string): boolean {
  return (
    /bloqu|coinc|ne s.?ouvre plus|ne s ouvre plus/.test(ctx) &&
    /enfant|fils|fille|bebe|dedans|enferm|dans la chambre|dans la piece|dans la pièce/.test(
      ctx,
    )
  );
}

function detectMechanicalDoorIssue(ctx: string): boolean {
  return /porte.*bloqu|bloqu.*porte|porte.*coinc|coinc.*porte|ne ferme plus|ferme pas|serrure|gache|gache|pecne|pe[cç]ne|poignee|poignée|targette|verrouill/.test(
    ctx,
  );
}

function detectAdministrativeLead(ctx: string): boolean {
  const maintenance =
    /fuite|fuit|eau|porte|serrure|electric|plomb|insalubre|hall sale|panne|reparation|réparation|degat|dégât|infiltr|moisi|nuisible|cafard|rat|frotte|gond|evier|évier|lavabo/.test(
      ctx,
    );
  if (maintenance) return false;

  const staffContact =
    /madame|monsieur|mme\b|mr\b|referent|référent|secretaire|secrétaire|accueil|agent|employe|employé/.test(
      ctx,
    );
  const documentHandoff =
    /document.*remettre|remettre.*document|document.*donner|apporter.*document|deposer.*document|d[eé]poser.*document/.test(
      ctx,
    );
  const presenceOrHours =
    /travail.*aujourd|travaille.*aujourd|present.*aujourd|pr[eé]sent.*aujourd|est.?elle la|est.?il la|ouvert.*aujourd|ferme.*aujourd|horaire|plage.*accueil/.test(
      ctx,
    );
  const adminTopic =
    /contestation.*charges|regulisation|regularisation|quittance|loyer.*impaye|impay[eé]|resiliation|r[eé]siliation|[eé]ch[eé]ancier|dossier.*locatif|bail.*renouvel/.test(
      ctx,
    );

  if (documentHandoff && staffContact) return true;
  if (presenceOrHours && staffContact) return true;
  if (adminTopic) return true;
  return false;
}

function detectPlumbingUrgent(ctx: string): boolean {
  return (
    /urgent|press|vit\b|i\s*jan/i.test(ctx) &&
    /eau|evier|évier|fuit|inond|dlo|lavabo|cuisine|sdb|salle de bain|wc|toilet|coule|goutte|debord|débord/.test(
      ctx,
    )
  );
}

function detectPlumbingFlooding(ctx: string): boolean {
  return (
    /inond|noy|noyee|noyée|nappe|flaque|au sol|par terre|debord|débord|rempli.*eau|eau.*rempli|plein.*eau|eau.*plein/.test(
      ctx,
    ) && /cuisine|evier|évier|sdb|salle de bain|lavabo|wc|toilet/.test(ctx)
  );
}

function detectPlumbingBackupLead(ctx: string): boolean {
  if (!detectPlumbingFlooding(ctx)) return false;
  return (
    PLUMBING_DIRTY_WATER_CTX.test(ctx) ||
    /rempli|plein|refou|debord|débord|remonte|eaux.usees|eaux usées|ne vid|nche pa|vide pas/.test(
      ctx,
    )
  );
}

/** Refoulement évacuation — détection sur contexte complet (titre + description). */
export function extractPlumbingBackupLead(ctx: string): boolean {
  return detectPlumbingBackupLead(norm(ctx));
}

function detectPlumbingEuRefoulementLead(ctx: string): boolean {
  if (!detectPlumbingBackupLead(ctx)) return false;
  return (
    PLUMBING_DIRTY_WATER_CTX.test(ctx) ||
    /eaux?\s+usees|eaux?\s+usées|refou|savon|mousseuse|mousse|remonte/.test(ctx)
  );
}

/** Refoulement EU colonne — eau sale / EU remontant par l’évier (3 verres, exutoire aval). */
export function extractPlumbingEuRefoulementLead(ctx: string): boolean {
  return detectPlumbingEuRefoulementLead(norm(ctx));
}

function detectEquipmentSubject(
  fullCtx: string,
  messageCtx: string,
  openingCtx: string,
): { equipmentSubject: TenantEquipmentSubject; subjectCorrected: boolean } {
  let equipmentSubject: TenantEquipmentSubject = null;
  if (PORTAIL_PATTERNS.test(fullCtx)) equipmentSubject = 'portail';
  if (MAILBOX_PATTERNS.test(fullCtx) && equipmentSubject !== 'portail') {
    equipmentSubject = 'mailbox';
  }

  if (messageCtx.trim()) {
    const msgSaysPortail = PORTAIL_PATTERNS.test(messageCtx);
    const msgSaysMailbox = MAILBOX_PATTERNS.test(messageCtx);
    if (msgSaysPortail && !msgSaysMailbox) equipmentSubject = 'portail';
    if (msgSaysMailbox && !msgSaysPortail) equipmentSubject = 'mailbox';
  }

  const openingSaysMailbox = MAILBOX_PATTERNS.test(openingCtx);
  const subjectCorrected =
    Boolean(messageCtx.trim()) &&
    equipmentSubject === 'portail' &&
    openingSaysMailbox &&
    (PORTAIL_PATTERNS.test(messageCtx) ||
      /je vous parle|je parle|pas.*boite|pas.*lettre|couvre portail|c.?est le portail/.test(
        messageCtx,
      ));

  return { equipmentSubject, subjectCorrected };
}

function norm(raw: string): string {
  return normClinicalText(raw);
}

function detectCommonAreas(ctx: string): string[] {
  const found: string[] = [];
  for (const { pattern, label } of COMMON_AREA_PATTERNS) {
    if (pattern.test(ctx) && !found.includes(label)) {
      found.push(label);
    }
  }
  return found;
}

/** Extrait les faits depuis tout le texte locataire accumulé. */
export function extractTenantSignalementFacts(params: {
  title: string;
  description: string;
  message?: string;
  prior?: TenantSignalementFacts | null;
}): TenantSignalementFacts {
  const ctx = norm(
    `${params.title} ${params.description} ${params.message ?? ''}`,
  );
  const messageCtx = norm(params.message ?? '');
  const openingCtx = norm(`${params.title} ${params.description}`);
  const { equipmentSubject, subjectCorrected } = detectEquipmentSubject(
    ctx,
    messageCtx,
    openingCtx,
  );
  const commonAreasMentioned = detectCommonAreas(ctx);
  const logementMentioned = LOGEMENT_PATTERNS.test(ctx);
  const salubriteIssue =
    SALUBRITE_PATTERNS.test(ctx) && !PLUMBING_DIRTY_WATER_CTX.test(ctx);
  const priorLandlordContact = PRIOR_CONTACT_PATTERNS.test(ctx);
  const safetyUrgent = detectSafetyUrgent(ctx);
  const mechanicalDoorIssue = detectMechanicalDoorIssue(ctx);
  const administrativeLead = detectAdministrativeLead(ctx);
  const plumbingUrgent = detectPlumbingUrgent(ctx);
  const plumbingFlooding = detectPlumbingFlooding(ctx);
  const plumbingBackupLead = detectPlumbingBackupLead(ctx);
  const plumbingEuRefoulementLead = detectPlumbingEuRefoulementLead(ctx);

  let locationScope: TenantLocationScope = 'unknown';
  const hasCommons = commonAreasMentioned.length > 0;

  if (hasCommons && logementMentioned) {
    locationScope = 'both';
  } else if (hasCommons) {
    locationScope = 'communs';
  } else if (logementMentioned) {
    locationScope = 'logement';
  }

  const communsAffirmed =
    /partag|parties communes|tous les voisins|pas dans mon logement|pas mon logement|pas chez moi|n.?est pas chez moi|vraiment les parties communes/.test(
      ctx,
    ) ||
    (/appart.*propre|logement.*propre/.test(ctx) && hasCommons);

  if (
    communsAffirmed &&
    hasCommons &&
    /pas dans mon logement|pas chez moi|n.?est pas chez moi|pas mon logement|parties communes/.test(ctx)
  ) {
    locationScope = 'communs';
  }

  const perimeterResolved =
    locationScope === 'both' ||
    (locationScope === 'communs' &&
      ((salubriteIssue && hasCommons) || communsAffirmed)) ||
    (locationScope === 'logement' &&
      /chambre|cuisine|salon|sdb|wc|salle de bain|logement entier/.test(ctx));

  const commonsSalubrityLead =
    salubriteIssue && (locationScope === 'communs' || locationScope === 'both' || hasCommons);

  const base: TenantSignalementFacts = {
    locationScope,
    commonAreasMentioned,
    logementMentioned,
    salubriteIssue,
    communsAffirmed,
    perimeterResolved,
    commonsSalubrityLead,
    priorLandlordContact,
    equipmentSubject,
    subjectCorrected,
    safetyUrgent,
    mechanicalDoorIssue,
    administrativeLead,
    plumbingUrgent,
    plumbingFlooding,
    plumbingBackupLead,
    plumbingEuRefoulementLead,
  };

  if (!params.prior) return base;

  return mergeTenantSignalementFacts(params.prior, base);
}

export function mergeTenantSignalementFacts(
  prior: TenantSignalementFacts,
  next: TenantSignalementFacts,
): TenantSignalementFacts {
  const commonAreasMentioned = [
    ...new Set([...prior.commonAreasMentioned, ...next.commonAreasMentioned]),
  ];
  const locationScope =
    next.locationScope !== 'unknown' ? next.locationScope : prior.locationScope;
  return {
    locationScope,
    commonAreasMentioned,
    logementMentioned: prior.logementMentioned || next.logementMentioned,
    salubriteIssue: prior.salubriteIssue || next.salubriteIssue,
    communsAffirmed: prior.communsAffirmed || next.communsAffirmed,
    perimeterResolved: prior.perimeterResolved || next.perimeterResolved,
    commonsSalubrityLead: prior.commonsSalubrityLead || next.commonsSalubrityLead,
    priorLandlordContact: prior.priorLandlordContact || next.priorLandlordContact,
    equipmentSubject: next.equipmentSubject ?? prior.equipmentSubject,
    subjectCorrected: prior.subjectCorrected || next.subjectCorrected,
    safetyUrgent: prior.safetyUrgent || next.safetyUrgent,
    mechanicalDoorIssue: prior.mechanicalDoorIssue || next.mechanicalDoorIssue,
    administrativeLead: prior.administrativeLead || next.administrativeLead,
    plumbingUrgent: prior.plumbingUrgent || next.plumbingUrgent,
    plumbingFlooding: prior.plumbingFlooding || next.plumbingFlooding,
    plumbingBackupLead: prior.plumbingBackupLead || next.plumbingBackupLead,
    plumbingEuRefoulementLead:
      prior.plumbingEuRefoulementLead || next.plumbingEuRefoulementLead,
  };
}

/** Sondes juridiques « logement vs hall » inutiles si le lieu est déjà dit. */
export function isPerimeterLegalProbeRedundant(
  probeId: string,
  facts: TenantSignalementFacts,
): boolean {
  if (!facts.perimeterResolved) return false;
  const perimeterProbes = new Set([
    'legal_clarify_decence',
    'legal_clarify_partie_commune',
  ]);
  if (!perimeterProbes.has(probeId)) return false;
  if (facts.locationScope === 'communs') return true;
  if (facts.locationScope === 'both') return true;
  return false;
}

/** Question locataire redondante (texte de sonde ou question physique générique). */
export function isPerimeterQuestionRedundant(
  question: string | null | undefined,
  facts: TenantSignalementFacts | null | undefined,
): boolean {
  if (!question?.trim() || !facts?.perimeterResolved) return false;
  const q = norm(question);
  if (/logement.*hall|hall.*logement|hall ou les escaliers|couloir.*escalier partag/.test(q)) {
    return true;
  }
  if (/seulement votre logement|dans votre logement, dans le hall/.test(q)) {
    return true;
  }
  if (facts.commonsSalubrityLead && /antenne|box|decodeur|décodeur|signal|chaine|chaîne/.test(q)) {
    return true;
  }
  if (
    facts.commonsSalubrityLead &&
    /marche|fissur|bouge.*escalier|niveau.*escalier|d.?autres marches/.test(q)
  ) {
    return true;
  }
  if (facts.equipmentSubject === 'portail' && /boite aux lettres|boîte aux lettres|bwat lèt|couvercle.*ouvr/.test(q)) {
    return true;
  }
  if (facts.equipmentSubject === 'mailbox' && /portail|moteur qui force|pòtay/.test(q)) {
    return true;
  }
  if (
    (facts.plumbingBackupLead || facts.plumbingFlooding) &&
    /sous l.?évier|anba évier|apparaît-elle sous|apparait-elle sous|en permanence.*ouvrez l.?eau|bouchon dans l.?évier/.test(
      q,
    )
  ) {
    return true;
  }
  return false;
}

/** Sondes Savoir incompatibles avec le sujet affirmé par le locataire. */
export function shouldSkipSavoirProbeForEquipment(
  probeId: string,
  facts: TenantSignalementFacts | null | undefined,
): boolean {
  if (!facts) return false;

  if (facts.equipmentSubject === 'portail' && probeId === 'mailbox_lock_mechanism') {
    return true;
  }
  if (facts.equipmentSubject === 'mailbox' && probeId === 'parking_gate_stuck') {
    return true;
  }

  // Salubrité communs — pas de sondes mécaniques / sécurité structure (marche, portail, boîte…).
  if (facts.commonsSalubrityLead) {
    const mechanicalCommonsProbes = new Set([
      'collective_stair_step_safety',
      'mailbox_lock_mechanism',
      'parking_gate_stuck',
    ]);
    if (mechanicalCommonsProbes.has(probeId)) return true;
  }

  return false;
}

/** Intake suffisant sans re-sonde — faits localisés et affirmés. */
export function shouldCompleteIntakeFromFacts(facts: TenantSignalementFacts): boolean {
  if (facts.administrativeLead) return true;
  if (facts.plumbingBackupLead) return true;
  if (!facts.perimeterResolved) return false;
  if (facts.commonsSalubrityLead) return true;
  if (facts.communsAffirmed && facts.commonAreasMentioned.length > 0) {
    return facts.locationScope === 'communs' || facts.locationScope === 'both';
  }
  return false;
}

export function tenantFactsToJarvisFacts(
  facts: TenantSignalementFacts,
): Record<string, string> {
  const out: Record<string, string> = {
    tenant_location_scope: facts.locationScope,
    tenant_perimeter_resolved: facts.perimeterResolved ? 'oui' : 'non',
  };
  if (facts.commonAreasMentioned.length) {
    out.tenant_common_areas = facts.commonAreasMentioned.join(', ');
  }
  if (facts.commonsSalubrityLead) {
    out.tenant_lead = 'salubrite_parties_communes';
  }
  if (facts.priorLandlordContact) {
    out.tenant_prior_contact = 'oui';
  }
  if (facts.equipmentSubject) {
    out.tenant_equipment_subject = facts.equipmentSubject;
  }
  if (facts.subjectCorrected) {
    out.tenant_subject_corrected = 'oui';
  }
  if (facts.safetyUrgent) {
    out.tenant_safety_urgent = 'oui';
  }
  if (facts.mechanicalDoorIssue) {
    out.tenant_mechanical_issue = 'porte_serrure';
  }
  if (facts.administrativeLead) {
    out.tenant_lead = 'demande_administrative';
  }
  if (facts.plumbingUrgent) {
    out.tenant_plumbing_urgent = 'oui';
  }
  if (facts.plumbingFlooding) {
    out.tenant_plumbing_flooding = 'oui';
  }
  if (facts.plumbingEuRefoulementLead) {
    out.tenant_lead = 'refoulement_eu_colonne';
    out.intervention_cible = 'hydrocureur';
    out.tenant_fait_evier_plein = 'oui';
    out.tenant_fait_cuisine_inondee = 'oui';
    out.tenant_fait_eau_sale = 'oui';
  } else if (facts.plumbingBackupLead) {
    out.tenant_lead = 'refoulement_evacuation';
  }
  return out;
}

/** Jarvis reformule ce qu’il a entendu — avant toute nouvelle question. */
export function jarvisAcknowledgeExtractedFacts(
  name: string,
  lang: CompanionLanguage,
  facts: TenantSignalementFacts,
): string | null {
  if (facts.subjectCorrected && facts.equipmentSubject === 'portail') {
    return pick(lang, {
      fr: `${name}, d’accord — on parle du portail, pas de la boîte aux lettres.`,
      gcf: `${name}, dakon — nou ka pale pòtay-la, pa bwat lèt.`,
      en: `${name}, understood — we’re talking about the gate, not the mailbox.`,
      pt: `${name}, certo — falamos do portão, não da caixa de correio.`,
      es: `${name}, de acuerdo — hablamos del portón, no del buzón.`,
      hat: `${name}, dakon — nou pale pòtay la, pa bwat lèt.`,
    });
  }

  if (!facts.perimeterResolved && !facts.salubriteIssue && !facts.subjectCorrected) return null;

  if (facts.commonsSalubrityLead && facts.locationScope === 'communs') {
    const places =
      facts.commonAreasMentioned.length > 0
        ? facts.commonAreasMentioned.join(' et ')
        : 'les parties communes';
    return pick(lang, {
      fr: `${name}, je vous ai bien entendu — surtout ${places}, pas votre logement.`,
      gcf: `${name}, mwen tande ou byen — plito ${places}, pa kay ou.`,
      en: `${name}, I heard you clearly — mainly ${places}, not inside your home.`,
      pt: `${name}, ouvi bem — sobretudo ${places}, não dentro da sua habitação.`,
      es: `${name}, le he oído bien — sobre todo ${places}, no dentro de su vivienda.`,
      hat: `${name}, mwen tande ou byen — sitou ${places}, pa nan kay ou.`,
    });
  }

  if (facts.locationScope === 'both' && facts.perimeterResolved) {
    return pick(lang, {
      fr: `${name}, je retiens que le souci touche à la fois votre logement et les parties communes.`,
      gcf: `${name}, mwen kenbe : pwoblèm nan kay ou é nan pati komen tou.`,
      en: `${name}, I note the issue affects both your home and the common areas.`,
      pt: `${name}, registo que o problema afeta a habitação e as partes comuns.`,
      es: `${name}, anoto que el problema afecta su vivienda y las zonas comunes.`,
      hat: `${name}, mwen kenbe : pwoblèm nan kay ou ak nan pati komen tou.`,
    });
  }

  if (facts.locationScope === 'logement' && facts.perimeterResolved) {
    return pick(lang, {
      fr: `${name}, je retiens que c’est surtout dans votre logement.`,
      gcf: `${name}, mwen kenbe : plito nan kay ou.`,
      en: `${name}, I note this is mainly inside your home.`,
      pt: `${name}, registo que é sobretudo dentro da habitação.`,
      es: `${name}, anoto que es sobre todo dentro de su vivienda.`,
      hat: `${name}, mwen kenbe : plito nan kay ou.`,
    });
  }

  return null;
}

const GENERIC_SIGNALEMENT_TITLES =
  /^(logement|partie commune|parties communes|signalement|probleme|problème|urgent|bonjour|aide|test|dossier|demande|souci|panne|reclamation|réclamation)$/i;

function isGenericSignalementTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (GENERIC_SIGNALEMENT_TITLES.test(t)) return true;
  return t.split(/\s+/).length <= 2 && t.length <= 16;
}

const TITLE_SYMPTOM_HINTS =
  /urgent|fuit|bloqu|inond|panne|coinc|insalubre|odeur|degat|dégât|ne ferme|accroch|coule|goutte|press|moisi|nuisible|electri|courant|lumi|cafard|inonder|debord|débord|rempli/i;

/** Titre = étiquette lieu (logement évier cuisine…) sans symptôme décrit. */
export function isLabelOnlySignalementTitle(title: string): boolean {
  const t = title.trim();
  if (!t || isGenericSignalementTitle(t)) return true;
  if (TITLE_SYMPTOM_HINTS.test(t)) return false;
  if (/^(logement|partie commune|signalement|probleme|problème)\b/i.test(t)) {
    return true;
  }
  if (
    /^(evier|évier|lavabo|porte|fuite|plomberie|cuisine|sdb|wc)\b/i.test(t) &&
    t.length <= 32
  ) {
    return true;
  }
  return false;
}

/** Corps du signalement — description prioritaire ; sinon texte symptomatique dans le titre. */
export function resolveSignalementBody(title: string, description: string): string {
  const t = title.trim();
  const d = description.trim();
  if (d.length >= 12) return d;
  if (t.length >= 20 && TITLE_SYMPTOM_HINTS.test(t)) return t;
  if (t.length >= 12 && !isLabelOnlySignalementTitle(t)) return t;
  return d.length > 0 ? d : t;
}

/** Reformule titre + description — lecture explicite de la réclamation (ouverture / clôture). */
function summarizeSignalement(title: string, description: string): string | null {
  const t = title.trim();
  const body = resolveSignalementBody(title, description);
  const preferDescription =
    isGenericSignalementTitle(t) || isLabelOnlySignalementTitle(t);

  if (preferDescription && body.length >= 12) {
    const cut = body.slice(0, 140);
    return cut.length < body.length ? `${cut}…` : cut;
  }
  if (t.length >= 8 && !preferDescription) return t;
  if (body.length >= 12) {
    const cut = body.slice(0, 140);
    return cut.length < body.length ? `${cut}…` : cut;
  }
  if (body.length >= 8) {
    const cut = body.slice(0, 140);
    return cut.length < body.length ? `${cut}…` : cut;
  }
  return t || body || null;
}

/** Jarvis lit la réclamation saisie — avant question ou transmission. */
export function jarvisReadSignalement(
  name: string,
  lang: CompanionLanguage,
  title: string,
  description: string,
  facts: TenantSignalementFacts | null | undefined,
): string | null {
  const summary = summarizeSignalement(title, description);

  if (facts?.administrativeLead) {
    const body =
      summary ??
      pick(lang, {
        fr: 'votre demande concernant l’accueil du bailleur',
        gcf: 'demann ou sou accueil Bailleur-la',
        en: 'your request about the landlord’s reception desk',
        pt: 'o seu pedido sobre o atendimento do senhorio',
        es: 'su consulta sobre la recepción del arrendador',
        hat: 'demann ou sou akèy pwopriyetè a',
      });
    return pick(lang, {
      fr: `${name}, j’ai lu votre message — ${body}.`,
      gcf: `${name}, mwen li mesaj ou — ${body}.`,
      en: `${name}, I’ve read your message — ${body}.`,
      pt: `${name}, li a sua mensagem — ${body}.`,
      es: `${name}, he leído su mensaje — ${body}.`,
      hat: `${name}, mwen li mesaj ou — ${body}.`,
    });
  }

  if (facts?.commonsSalubrityLead) {
    const places =
      facts.commonAreasMentioned.length > 0
        ? facts.commonAreasMentioned.join(' et ')
        : 'les parties communes';
    const relance = facts.priorLandlordContact
      ? pick(lang, {
          fr: ', avec des relances déjà adressées au bailleur',
          gcf: ', é ou te deja ekri Bailleur-la',
          en: ', after prior messages to the landlord with no response',
          pt: ', com contactos prévios ao senhorio sem resposta',
          es: ', con recordatorios previos al arrendador sin respuesta',
          hat: ', é ou te deja ekri pwopriyetè a',
        })
      : '';
    return pick(lang, {
      fr: `${name}, j’ai lu votre signalement — salubrité du ${places}${relance}.`,
      gcf: `${name}, mwen li siyalman ou — salubrite ${places}${relance}.`,
      en: `${name}, I’ve read your report — cleanliness issue in the ${places}${relance}.`,
      pt: `${name}, li o seu pedido — salubridade do ${places}${relance}.`,
      es: `${name}, he leído su aviso — salubridad del ${places}${relance}.`,
      hat: `${name}, mwen li siyalman ou — salubrite ${places}${relance}.`,
    });
  }

  if (
    facts?.perimeterResolved &&
    facts.locationScope === 'communs' &&
    facts.commonAreasMentioned.length > 0
  ) {
    const places = facts.commonAreasMentioned.join(' et ');
    return pick(lang, {
      fr: `${name}, j’ai lu votre signalement — c’est sur ${places}, parties communes.`,
      gcf: `${name}, mwen li siyalman ou — sé sou ${places}, pati komen.`,
      en: `${name}, I’ve read your report — it concerns ${places}, common areas.`,
      pt: `${name}, li o seu pedido — trata-se de ${places}, partes comuns.`,
      es: `${name}, he leído su aviso — afecta a ${places}, zonas comunes.`,
      hat: `${name}, mwen li siyalman ou — sé sou ${places}, pati komen.`,
    });
  }

  if (summary) {
    return pick(lang, {
      fr: `${name}, j’ai lu votre signalement — ${summary}.`,
      gcf: `${name}, mwen li siyalman ou — ${summary}.`,
      en: `${name}, I’ve read your report — ${summary}.`,
      pt: `${name}, li o seu pedido — ${summary}.`,
      es: `${name}, he leído su aviso — ${summary}.`,
      hat: `${name}, mwen li siyalman ou — ${summary}.`,
    });
  }

  return null;
}

type L = CompanionLanguage;

function pick(lang: L, table: Record<L, string>): string {
  return table[lang] ?? table.fr;
}
