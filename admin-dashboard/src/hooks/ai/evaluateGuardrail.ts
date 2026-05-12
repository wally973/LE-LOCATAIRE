import { GUARDRAIL_REFUSAL_MESSAGE_FR } from './legalDisclaimer';
import type { AIGuardrailResult } from './pipelineTypes';

export interface EvaluateGuardrailOptions {
  /**
   * Si true (défaut), refuse la requête dès lors qu’indices de données personnelles sont détectés.
   * Désactiver uniquement en environnement maîtrisé (jamais en prod utilisateur sans validation DPO).
   */
  rgpdStrictMode?: boolean;
}

/** Nettoyage minimal (normalisation avant analyse). */
export function minimalCleanText(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Catégories interdites — refus immédiat (hors univers logement/app). */
const BLOCKED_THEME_PATTERNS: RegExp[] = [
  /\b(?:politique|politiciens?|élections?|scrutin\s+président)/i,
  /\b(?:religion|islam(?:isme)?|christianisme|bouddhisme|juifs?|musulman|église\b)/i,
  /\b(?:santé\b|médicin|hôpital|dentiste|cancer\s+du|diagnostic\s+médical)/i,
  /\b(?:immigration|sans[-\s]?papiers|titre\s+de\s+séjour|visa\s+schengen)/i,
  /\bfiscalité\b|\bimpôts?\s+sur\s+(?:le\s+)?revenu|\bdéclaration\s+fiscale\b/i,
  /\bdroit\s+du\s+travail\b|\blicenciement\s+(?:abusif|économique)?/i,
  /\bdroit\s+pénal\b|\bprison\s+(?:ferme|pour)\b|\bacquittement\s+pénal/i,
  /\bdroit\s+de\s+la\s+famille\b|\bdivorce\b.*\bgarde\b|\bpension\s+alimentaire\b/i,
  /\bhistoire\s+(?:de\s+)?(?:france|mondiale)\b|\bculture\s+générale\b|\bquiz\b/i,
  /\bmétéo\b|\btemps\s+qu['']?\s*il\s+fait\b/i,
  /\btraduis\s+(?:en|ce\s+texte|verbatim)\b|\btranslate\s+the\s+following\b/i,
  /\banalyse[rz]?\s+ce\s+(?:pdf|document)\s+externe\b/i,
  /\bconseils?\s+juridiques?\s+personnalis|\b(?:que\s+)?dois-[jJ]e\s+faire\s+légalement\b/i,
  /\bconversation\s+libre\b|\braconte\b.+\bvie\b|\bquestions?\s+personnelles\b/i,
];

/** Indices de périmètre autorisé (logement, app, tickets, médiation liée au logement). */
const ALLOWED_SCOPE_PATTERNS: RegExp[] = [
  /\b(?:mon\s+)?logement|studio|appartement|immeuble|cave|parking\s+locatif/i,
  /\b(?:locataire|bailleur)s?\b/i,
  /\bloyer|quittance|caution|charges\b/i,
  /\b(?:réparation|réparer|panne|dégât|dégâts|humidité|moisissures?|fuite|plomberie|électricité|serrure|vitrage)/i,
  /\b(?:ticket|signalement|demande\s+d['']intervention)/i,
  /\b(?:paiements?|facture|stripe)\b/i,
  /\b(?:clcv|adil|médiation|conciliateur\s+de\s+justice)\b/i,
  /\brdv|rendez[-\s]?vous|visite\s+technique/i,
  /\bapplication|tableau\s+de\s+bord|écran|menu|bouton/i,
  /\b(?:comment|où)\s+.+\b(?:paiements?|tickets?|profil|paramètres?|dashboard)\b/i,
  /\b(?:réseaux?\s+)?sociaux?\b(?=.*\b(?:voisin|immeuble|logement))/i,
];

const EMAIL =
  /\b[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,64}\.[a-zA-Z]{2,63}\b/;

/** Téléphone FR / formats proches (+33, espaces). */
const PHONE_FR =
  /(?:\+33|0033|0)(?:[\s.-]?\d){8,}\b|\b0[67](?:[\s.-]?\d{2}){4}\b/;

/** Adresse-type (évite faux positifs seuls numéros). */
const ADDRESS_LIKE =
  /\b(?:rue|avenue|av\.?|bd|boulevard|route|chemin|impasse|place|all[eé]e)[\s,]+[^,\n]{1,120}\d{1,5}\b|\b\d{5}\s+[A-Za-zÀ-ÖØ-öø-ÿ\-\s]{4,}\b/iu;

/** Indices “je donne mon identité” (RGPD strict). */
const SELF_IDENT =
  /\b(?:je\s+m['’]?appelle|mon\s+nom\s+(?:est|c['’]?est)|mon\s+(?:mail|email|courriel)|(?:mon|mes)\s+coordonnées)\b/i;

function containsPersonalData(text: string): boolean {
  if (EMAIL.test(text)) return true;
  if (SELF_IDENT.test(text)) return true;
  if (PHONE_FR.test(text)) return true;
  return ADDRESS_LIKE.test(text);
}

function isShortNeutralGreeting(t: string): boolean {
  if (t.length > 160) return false;
  return /^[\s,;.!?+\\-]*(?:bonjour|bonsoir|salut|hello|hi|hey|merci|thanks|au\s+revoir|ok|d['']accord)[\s!.?]*$/iu.test(
    t,
  );
}

/**
 * Bride IA — périmètre strict : logement / tickets / paiements / navigation app / médiation (CLCV–ADIL comme recours).
 * Détection données personnelles si `rgpdStrictMode` !== false.
 */
export function evaluateGuardrail(
  userTextRaw: string,
  options?: EvaluateGuardrailOptions,
): AIGuardrailResult {
  const strict = options?.rgpdStrictMode !== false;

  const userText = minimalCleanText(userTextRaw);

  if (!userText.length) {
    return { allowed: true, reason: 'EMPTY_INPUT_NAV_ONLY' };
  }

  if (strict && containsPersonalData(userText)) {
    return {
      allowed: false,
      safeMessage: GUARDRAIL_REFUSAL_MESSAGE_FR,
      reason: 'PERSONAL_DATA_DETECTED',
    };
  }

  if (BLOCKED_THEME_PATTERNS.some((re) => re.test(userText))) {
    return {
      allowed: false,
      safeMessage: GUARDRAIL_REFUSAL_MESSAGE_FR,
      reason: 'FORBIDDEN_TOPIC',
    };
  }

  const inScope =
    ALLOWED_SCOPE_PATTERNS.some((re) => re.test(userText)) ||
    isShortNeutralGreeting(userText);

  if (!inScope) {
    return {
      allowed: false,
      safeMessage: GUARDRAIL_REFUSAL_MESSAGE_FR,
      reason: 'NOT_IN_SCOPE',
    };
  }

  return { allowed: true, reason: 'IN_SCOPE' };
}
