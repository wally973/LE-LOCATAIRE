import type { PreprocessedSignal } from '../preprocessor/preprocessor.types';
import { mentionsPrevenirVoisinDessus } from '../domain/packs/social-housing/head5-parole-supplement';

/**
 * Cas de référence mobile — infiltration plafond / eau qui coule du dessus.
 * Validé terrain : essai mobile 06/07/2026, E2E scripts #118–#121.
 */
export const INFILTRATION_PLAFOND_MOBILE_REF = {
  id: 'REF_INFILTRATION_PLAFOND_MOBILE',
  tenantFirstName: 'Marie',
  title: "j'ai de l'eau qui coule du plafond",
  description: "j'ai de l'eau qui coule du plafond de la salle de bain",
  tenantMessage: "j'ai de l'eau qui coule du plafond de la salle de bain",
  photoFeedback: 'Photo des gouttes et taches au plafond.',
  visualPerceptionRaw:
    'plafond salle de bain, traces humidité, écoulement actif, auréoles brunes au plafond',
  expectedState: 'sinistre' as const,
  /** Thèmes minimaux — harness capteurs ↔ parole (Tête 5). */
  requiredSpeechThemeIds: [
    'assurance_sinistre',
    'delai_5j',
    'securite',
    'prevenir_voisin_dessus',
    'technicien_transmission',
  ] as const,
};

const PLAFOND_INFILTRATION_RE =
  /plafond|infiltr|goutte|eau qui coule|coule du plafond/i;

/** Signalement correspondant au cas de référence mobile plafond. */
export function isInfiltrationPlafondMobileSignalement(
  title: string,
  description: string,
): boolean {
  const corpus = `${title} ${description}`.toLowerCase();
  return PLAFOND_INFILTRATION_RE.test(corpus) && /eau|goutte|coule|fuite|humid/i.test(corpus);
}

/** Signal Couche 0 synthétique pour tests unitaires (pipeline T1→T5). */
export function buildInfiltrationPlafondMobileSignal(
  overrides: Partial<PreprocessedSignal> = {},
): PreprocessedSignal {
  const ref = INFILTRATION_PLAFOND_MOBILE_REF;
  return {
    tenantFirstName: ref.tenantFirstName,
    title: ref.title,
    description: ref.description,
    tenantMessage: ref.tenantMessage,
    sessionMessages: [],
    interlocutor: 'tenant',
    signalementBlock: 'block',
    visualPerceptionRaw: ref.visualPerceptionRaw,
    visionModel: 'pixtral',
    signalQuality: 8,
    signalQualityFactors: {
      textCoherence: 8,
      textAmbiguityPenalty: 0,
      imageQuality: 7,
      hasImage: true,
      perceptionAvailable: true,
    },
    meta: { role: 'tenant', textFieldsNormalized: 0, imageProcessed: true },
    ...overrides,
  };
}

/** Assertions parole locataire — cas REF_INFILTRATION_PLAFOND_MOBILE. */
export function assertInfiltrationPlafondMobileParole(acknowledgment: string): string[] {
  const failures: string[] = [];
  const ack = acknowledgment.trim();
  if (!ack) {
    failures.push('bulle vide');
    return failures;
  }
  const lower = ack.toLowerCase();
  if (!/assur|sinistre/i.test(lower)) failures.push('assurance / sinistre');
  if (!/5\s*jour|cinq\s*jour|ouvr[eé]/i.test(lower)) failures.push('délai 5 jours ouvrés');
  if (!/s[eé]cur|danger|urgence|ne touchez|[eé]loign|lectri/i.test(lower)) {
    failures.push('consigne sécurité');
  }
  if (!/technicien|transm|interven/i.test(lower)) failures.push('transmission technicien');
  if (!mentionsPrevenirVoisinDessus(ack)) {
    failures.push('proposition de prévenir le voisin du dessus (consigne locataire)');
  }
  return failures;
}
