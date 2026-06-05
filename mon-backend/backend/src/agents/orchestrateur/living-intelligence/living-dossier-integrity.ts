/**
 * Étanchéité des dossiers — Un ticket = un métier (V2 FINALE).
 * Après transmission technicien, tout nouveau sujet → nouvelle demande.
 */
import { detectMultipleClaims } from '../../chercheur/knowledge/lia-multi-claim';
import { isConfirmedTopicChange } from '../intake/lia-jarvis-intake.engine';
import type { IntakeCategory } from '../intake/lia-intake.service';
import type { LivingBuildingState, LivingDossierIntegrity } from './living-building-state.types';

function norm(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function createOpenDossierIntegrity(): LivingDossierIntegrity {
  return {
    sealed: false,
    sealedAt: null,
    primaryTrade: null,
    signalementScope: null,
    oneTicketOneTrade: true,
  };
}

/** Scelle le dossier après transmission technicien. */
export function sealDossierIntegrity(state: LivingBuildingState): LivingBuildingState {
  if (state.dossierIntegrity.sealed) return state;
  if (
    state.readiness !== 'READY_FOR_TECHNICIAN' &&
    !state.intervention.readyForDispatch
  ) {
    return state;
  }

  return {
    ...state,
    dossierIntegrity: {
      ...state.dossierIntegrity,
      sealed: true,
      sealedAt: new Date().toISOString(),
      primaryTrade: state.intervention.tradeNeeded,
      signalementScope: `${state.signalementTitle} — ${state.signalementDescription}`.slice(
        0,
        400,
      ),
    },
  };
}

export interface DossierTopicBreach {
  isNewSubject: boolean;
  detectedLabel: string | null;
}

function inferTicketCategory(
  title: string,
  description: string,
  intakeCategory?: IntakeCategory | null,
): IntakeCategory | null {
  if (intakeCategory) return intakeCategory;
  return (
    detectMultipleClaims(title, description)[0]?.category ?? null
  );
}

/** Signaux métier distincts du dossier scellé (enveloppe, plomberie, serrure…). */
function detectSealedDomainShift(
  scopeText: string,
  message: string,
): { shifted: boolean; label: string | null } {
  const scope = norm(scopeText);
  const msg = norm(message);
  const shifts: Array<{ scopeHint: RegExp; msgHint: RegExp; label: string }> = [
    {
      scopeHint: /moisiss|infiltr|plafond|toit|etanche|humid/,
      msgHint: /porte|serrur|cle|gache/,
      label: 'Porte / serrure',
    },
    {
      scopeHint: /moisiss|infiltr|plafond|toit|etanche|humid/,
      msgHint: /electri|disjoncteur|prise|ampoule/,
      label: 'Électricité',
    },
    {
      scopeHint: /moisiss|infiltr|plafond|toit|etanche|humid/,
      msgHint: /fuite|evier|wc|robinet|lavabo/,
      label: 'Plomberie',
    },
    {
      scopeHint: /electri|prise|disjoncteur/,
      msgHint: /moisiss|infiltr|fuite|porte|serrur/,
      label: 'Autre métier',
    },
    {
      scopeHint: /fuite|evier|plomb|wc/,
      msgHint: /electri|moisiss|porte|serrur/,
      label: 'Autre métier',
    },
  ];

  for (const rule of shifts) {
    if (rule.scopeHint.test(scope) && rule.msgHint.test(msg)) {
      const claims = detectMultipleClaims(message, message);
      return {
        shifted: true,
        label: claims[0]?.label ?? rule.label,
      };
    }
  }

  if (/porte.*(ferme|bloqu|coinc)|ne ferme plus|serrure|cle perdue/i.test(message)) {
    const envelopeScope = /moisiss|infiltr|plafond|toit|etanche/.test(scope);
    if (envelopeScope) {
      return { shifted: true, label: 'Porte / serrure' };
    }
  }

  return { shifted: false, label: null };
}

/** Détecte un changement de sujet après scellement du dossier. */
export function detectDossierTopicBreach(params: {
  state: LivingBuildingState;
  message: string;
  intakeCategory?: IntakeCategory | null;
}): DossierTopicBreach {
  if (!params.state.dossierIntegrity?.sealed) {
    return { isNewSubject: false, detectedLabel: null };
  }

  const msg = params.message.trim();
  if (!msg) return { isNewSubject: false, detectedLabel: null };

  const ticketCategory = inferTicketCategory(
    params.state.signalementTitle,
    params.state.signalementDescription,
    params.intakeCategory,
  );

  if (
    isConfirmedTopicChange(
      msg,
      params.state.signalementTitle,
      params.state.signalementDescription,
      ticketCategory,
    )
  ) {
    const claims = detectMultipleClaims(msg, msg);
    return {
      isNewSubject: true,
      detectedLabel: claims[0]?.label ?? 'un autre sujet',
    };
  }

  const domainShift = detectSealedDomainShift(
    `${params.state.signalementTitle} ${params.state.signalementDescription}`,
    msg,
  );
  if (domainShift.shifted) {
    return { isNewSubject: true, detectedLabel: domainShift.label };
  }

  const scope = norm(params.state.signalementDescription);
  const title = norm(params.state.signalementTitle);
  const m = norm(msg);
  const ticketWords = [...scope.split(/\s+/), ...title.split(/\s+/)]
    .filter((w) => w.length > 4)
    .slice(0, 12);
  const overlap = ticketWords.filter((w) => m.includes(w)).length;
  const claims = detectMultipleClaims(msg, msg);
  if (claims.length > 0 && overlap < 1) {
    return { isNewSubject: true, detectedLabel: claims[0].label };
  }

  return { isNewSubject: false, detectedLabel: null };
}

/** Parole Majordome — nouveau dossier (pas de script oui/non). */
export function buildNewDossierRequestMessage(
  displayName: string,
  detectedLabel: string | null,
  language: 'fr' | 'gcf' = 'fr',
): string {
  const name = displayName.trim() || 'Marie';
  const sujet = detectedLabel ? ` « ${detectedLabel} »` : ' ce nouveau sujet';

  if (language === 'gcf') {
    return (
      `${name}, mèsi pou konfyans. Dossier-la déjà voye bay technisyen. ` +
      `Pou${sujet}, ouvri yon nouvo demann depi lakay-la — yon tikè, yon métier, pou swivi byen.`
    );
  }

  return (
    `${name}, votre dossier actuel est déjà transmis au technicien référent — ` +
    `je veille à la qualité du suivi : un ticket, un métier. ` +
    `Pour${sujet}, ouvrez une nouvelle demande depuis l’accueil de l’application : ` +
    `c’est la meilleure façon d’être prise en charge rapidement et sans mélanger les interventions.`
  );
}
