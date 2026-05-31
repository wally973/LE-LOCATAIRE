/**
 * Jarvis parle — synthèse depuis le conseil et le Savoir (data), pas de directives scénario.
 */
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import type { CouncilRound } from './lia-jarvis-council.types';
import {
  isTenantConfirmedClinicalLink,
  matchClinicalLinks,
  pickSavoirProbe,
  probeQuestionMatchesResolved,
} from './lia-savoir-clinical-links.loader';
import { pickLegalClarificationProbe, hasLegalChargeContext, shouldUseLegalClarificationProbe } from './lia-juridique-savoir.loader';
import type { HousingKind } from './lia-housing-perspective';
import type { JarvisSimulationState } from './lia-jarvis-simulation.engine';
import { jarvisThanks, inferPostIntakeFollowUpKind, jarvisClosingByFollowUpKind, jarvisClosingWithSignalementRead, appendJarvisIntakeTransmission } from './lia-jarvis-dialogue.i18n';
import {
  jarvisAcknowledgeExtractedFacts,
  extractTenantSignalementFacts,
  isPerimeterQuestionRedundant,
  jarvisReadSignalement,
} from './lia-tenant-signalement-facts';

export interface JarvisVoiceTurn {
  acknowledgment: string;
  nextQuestion: string | null;
}

/** Une voix locataire : remerciement + contenu Savoir (data), pas de jargon console. */
export function synthesizeJarvisFromCouncil(params: {
  name: string;
  lang: CompanionLanguage;
  message: string;
  title: string;
  description: string;
  housingKind: HousingKind;
  simulation: JarvisSimulationState;
  councilRound: CouncilRound;
  fallbackQuestion: string | null;
}): JarvisVoiceTurn {
  const { simulation, name, lang, message } = params;
  const msg = message.trim();

  const tenantFacts =
    simulation.tenantFacts ??
    extractTenantSignalementFacts({
      title: params.title,
      description: params.description,
      message: msg,
    });

  const links = matchClinicalLinks({
    title: params.title,
    description: params.description,
    message: msg,
    housingKind: params.housingKind,
    activeFlows: simulation.activeFlows,
  });
  const matchedLink = links[0];
  const linkConfirmed =
    matchedLink != null && isTenantConfirmedClinicalLink(matchedLink, msg);

  let acknowledgment =
    jarvisAcknowledgeExtractedFacts(name, lang, tenantFacts) ??
    jarvisThanks(name, lang);

  // Lien confirmé par le locataire → explication + transmission, pas de re-sonde.
  if (linkConfirmed && matchedLink) {
    if (matchedLink.tenantExplanation) {
      acknowledgment += ` ${matchedLink.tenantExplanation}`;
    }
    if (matchedLink.transmissionHint) {
      acknowledgment += ` ${matchedLink.transmissionHint}`;
    }
    return { acknowledgment: acknowledgment.trim(), nextQuestion: null };
  }

  if (simulation.intakeComplete) {
    const followUpKind = inferPostIntakeFollowUpKind(
      simulation.domain,
      params.title,
      params.description,
    );
    const read = jarvisReadSignalement(
      name,
      lang,
      params.title,
      params.description,
      tenantFacts,
    );
    const closing = read
      ? jarvisClosingWithSignalementRead({
          name,
          lang,
          kind: followUpKind,
          domain: simulation.domain,
          read,
        })
      : jarvisClosingByFollowUpKind(name, lang, followUpKind, simulation.domain);
    return {
      acknowledgment: appendJarvisIntakeTransmission(closing, lang),
      nextQuestion: null,
    };
  }

  const legalProbe = pickLegalClarificationProbe({
    title: params.title,
    description: params.description,
    message: msg,
    language: lang,
    resolvedSteps: simulation.resolvedSteps,
  });

  const probe = pickSavoirProbe({
    housingKind: params.housingKind,
    activeFlows: simulation.activeFlows,
    resolvedSteps: simulation.resolvedSteps,
    language: lang,
    title: params.title,
    description: params.description,
    message: params.message,
  });

  const chargeContext = hasLegalChargeContext(
    `${params.title} ${params.description} ${msg}`,
  );

  if (
    shouldUseLegalClarificationProbe({
      probe: legalProbe,
      chargeContext,
      hasPhysicalProbe: probe != null,
    }) &&
    legalProbe
  ) {
    return {
      acknowledgment: acknowledgment.trim(),
      nextQuestion: legalProbe.question,
    };
  }

  let nextQuestion = params.fallbackQuestion;

  if (probe) {
    nextQuestion = probe.question;
  }

  if (nextQuestion && isPerimeterQuestionRedundant(nextQuestion, tenantFacts)) {
    const fallback = params.fallbackQuestion;
    nextQuestion =
      fallback && !isPerimeterQuestionRedundant(fallback, tenantFacts)
        ? fallback
        : null;
  }
  if (
    nextQuestion &&
    probeQuestionMatchesResolved(nextQuestion, simulation.resolvedSteps)
  ) {
    const fallback = params.fallbackQuestion;
    nextQuestion =
      fallback && !isPerimeterQuestionRedundant(fallback, tenantFacts)
        ? fallback
        : null;
  }

  return { acknowledgment: acknowledgment.trim(), nextQuestion };
}
