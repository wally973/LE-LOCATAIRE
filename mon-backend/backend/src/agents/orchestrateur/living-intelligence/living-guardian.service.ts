/**
 * Le Gardien — couche souveraine post-délibération (Phase B N7).
 * Quatre missions : cohérence, sécurité, protection sociale, doctrine (Stylo).
 */
import { Injectable, Logger } from '@nestjs/common';
import type { LiaTenantSocialContext } from '../../shared/lia-jarvis-identity';
import type {
  LivingBuildingState,
  LivingDeliberationTurnResult,
  LivingExpertReports,
  LivingGuardianMission,
  LivingGuardianReview,
  LivingPendingDoctrineLesson,
} from './living-building-state.types';
import {
  isLivingSafetyLockActive,
} from './living-building-state.safety';
import {
  resolveTenantProfile,
  sanitizeTenantMessageForVulnerability,
} from './living-professional-consciousness';

export type GuardianVerdictKind = LivingGuardianReview['verdict'];

export interface GuardianReviewInput {
  result: LivingDeliberationTurnResult;
  tenantSocial?: LiaTenantSocialContext | null;
  pendingDoctrineLessons?: LivingPendingDoctrineLesson[];
}

export interface GuardianReviewOutput {
  verdict: GuardianVerdictKind;
  murmures: string[];
  missionsTriggered: LivingGuardianMission[];
  originalParole: string;
  finalParole: string;
  redeliberationBrief: string | null;
  livingState: LivingBuildingState;
}

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function asString(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

const DANGEROUS_INSTRUCTION_RE =
  /(?:montez|grimpez|forcez|coupez le disjoncteur|d[eé]bouchez|debouchez|changez l.?ampoule|nettoiez|essayez de r[eé]parer|vous pouvez (couper|forcer|monter))/i;

const SAFETY_FIRST_RE =
  /disjoncteur|coupez|coup[eé]|éloign|eloign|ne touchez|sans danger|eau coup|robinet.*ferm/i;

/** Mission 1 — veto cohérence Majordome vs vision Enquêteur. */
function auditCoherence(params: {
  state: LivingBuildingState;
  tenantMessage: string;
  expertReports?: LivingExpertReports | null;
}): { triggered: boolean; murmur: string; redeliberationBrief: string | null } {
  const speech = norm(params.tenantMessage);
  const enq = params.expertReports?.enqueteur;
  const enqText = norm(
    [
      asString(enq?.insight),
      JSON.stringify(enq?.vision3d ?? {}),
      JSON.stringify(enq?.safetyLock ?? {}),
      params.state.vision3d.symptomAnchor,
      ...params.state.vision3d.activeFlows,
      ...params.state.vision3d.mentalModels,
    ].join(' '),
  );

  const enqueteurElectricalDanger =
    params.state.safetyLock.severityZone === 'ZENITH_DANGER' ||
    params.state.safetyLock.hazardType === 'electrical' ||
    params.state.safetyLock.requiresPowerCutoff ||
    /arc|gr[eé]sill|prise arrach|court.?circuit|electri.*danger|zenith/.test(enqText);

  const majordomeTrivialLight =
    /ampoule|lustre|plafonnier|[eé]clairage|ampoule grill/.test(speech) &&
    !/danger|[eé]lectri|disjoncteur|gr[eé]sill|arc|urgence/.test(speech);

  if (enqueteurElectricalDanger && majordomeTrivialLight) {
    return {
      triggered: true,
      murmur:
        'Veto cohérence — le Majordome parle ampoule/éclairage alors que l’Enquêteur voit un danger électrique.',
      redeliberationBrief:
        'GARDIEN — incohérence : vision Enquêteur = danger électrique (arc/grésillement). ' +
        'Ne minimisez pas en ampoule. Priorité sécurité puis diagnostic.',
    };
  }

  const enqueteurEnvelope =
    /enveloppe|infiltr|toit|etancheit|[eé]tanch[eé]it|moisiss.*plafond/.test(enqText);
  const majordomePlumbingOnly =
    /plombier|joint|robinet|siphon/.test(speech) &&
    !/enveloppe|toiture|infiltr|structure/.test(speech);

  if (enqueteurEnvelope && majordomePlumbingOnly && !/fuite.*(evier|évier|lavabo)/.test(enqText)) {
    return {
      triggered: true,
      murmur:
        'Veto cohérence — parole orientée plomberie vs vision enveloppe/infiltration Enquêteur.',
      redeliberationBrief:
        'GARDIEN — alignez la parole sur la vision Enquêteur (enveloppe / infiltration), pas plomberie seule.',
    };
  }

  return { triggered: false, murmur: '', redeliberationBrief: null };
}

/** Mission 2 — verrou sécurité ZENITH : consigne en tête de réponse. */
function auditSafetyLock(params: {
  state: LivingBuildingState;
  tenantMessage: string;
}): { triggered: boolean; murmur: string; finalParole: string | null } {
  const lockActive =
    isLivingSafetyLockActive(params.state) ||
    (params.state.safetyLock.severityZone === 'ZENITH_DANGER' &&
      !params.state.safetyLock.safetyVerified);

  if (!lockActive) {
    return { triggered: false, murmur: '', finalParole: null };
  }

  const firstChunk = params.tenantMessage.slice(0, 220);
  if (SAFETY_FIRST_RE.test(firstChunk)) {
    return {
      triggered: false,
      murmur: 'Verrou ZENITH — consigne de sécurité présente en tête de parole.',
      finalParole: null,
    };
  }

  const name = params.state.humanBarrier.displayName || 'Marie';
  let header: string;
  if (params.state.safetyLock.requiresWaterShutoff) {
    header = `${name}, coupez l’eau tout de suite si vous le pouvez sans danger — ne touchez à rien. `;
  } else {
    header = `${name}, éloignez-vous tout de suite — coupez le disjoncteur si vous pouvez sans danger. `;
  }

  return {
    triggered: true,
    murmur:
      'Safety Override — ZENITH_DANGER sans consigne en tête : réécriture autoritaire de l’en-tête.',
    finalParole: `${header}${params.tenantMessage}`,
  };
}

/** Mission 3 — protection sociale Marie. */
function auditSocialProtection(params: {
  state: LivingBuildingState;
  tenantMessage: string;
  tenantSocial?: LiaTenantSocialContext | null;
}): { triggered: boolean; murmur: string; finalParole: string | null } {
  const profile = resolveTenantProfile(params.state, params.tenantSocial);
  const stateWithProfile = { ...params.state, tenantProfile: profile };

  if (!profile.isVulnerable) {
    return { triggered: false, murmur: '', finalParole: null };
  }

  const lockActive = isLivingSafetyLockActive(params.state);
  if (
    lockActive &&
    /disjoncteur|coupez|coup[eé]|éloign|eloign|ne touchez|sans danger|eau coup/.test(
      params.tenantMessage,
    )
  ) {
    return {
      triggered: false,
      murmur: 'Protection sociale — consigne sécurité légitime (ZENITH), pas de veto.',
      finalParole: null,
    };
  }

  if (!DANGEROUS_INSTRUCTION_RE.test(params.tenantMessage)) {
    return {
      triggered: false,
      murmur: `Protection sociale — profil vulnérable (${profile.reason}), parole conforme.`,
      finalParole: null,
    };
  }

  const safe = sanitizeTenantMessageForVulnerability(params.tenantMessage, stateWithProfile);
  return {
    triggered: true,
    murmur: `Veto protection sociale — consigne physique interdite pour ${profile.reason}.`,
    finalParole: safe,
  };
}

/** Mission 4 — Stylo doctrine : PENDING_ADMIN_SIGNATURE uniquement. */
function auditDoctrinePending(
  pending: LivingPendingDoctrineLesson[],
): { triggered: boolean; murmures: string[] } {
  if (!pending.length) {
    return { triggered: false, murmures: [] };
  }
  return {
    triggered: true,
    murmures: pending.map(
      (l) =>
        `Stylo intercepté — « ${l.title} » (${l.author}) → PENDING_ADMIN_SIGNATURE · ${l.id}`,
    ),
  };
}

@Injectable()
export class LivingGuardianService {
  private readonly logger = new Logger(LivingGuardianService.name);

  review(input: GuardianReviewInput): GuardianReviewOutput {
    const { result, tenantSocial, pendingDoctrineLessons = [] } = input;
    const state = result.livingState;
    const originalParole = result.tenantMessage;
    const murmures: string[] = [];
    const missionsTriggered: LivingGuardianMission[] = [];

    murmures.push('— Murmures du Gardien — tour souverain post-délibération —');

    const coherence = auditCoherence({
      state,
      tenantMessage: originalParole,
      expertReports: state.symmetricDeliberation?.expertReports,
    });
    if (coherence.triggered) {
      missionsTriggered.push('COHERENCE');
      murmures.push(coherence.murmur);
    } else if (coherence.murmur) {
      murmures.push(coherence.murmur);
    }

    const safety = auditSafetyLock({ state, tenantMessage: originalParole });
    if (safety.triggered) {
      missionsTriggered.push('SAFETY');
      murmures.push(safety.murmur);
    } else if (safety.murmur) {
      murmures.push(safety.murmur);
    }

    const social = auditSocialProtection({
      state,
      tenantMessage: safety.finalParole ?? originalParole,
      tenantSocial,
    });
    if (social.triggered) {
      missionsTriggered.push('SOCIAL');
      murmures.push(social.murmur);
    } else if (social.murmur) {
      murmures.push(social.murmur);
    }

    const doctrine = auditDoctrinePending(pendingDoctrineLessons);
    if (doctrine.triggered) {
      missionsTriggered.push('DOCTRINE');
      murmures.push(...doctrine.murmures);
    }

    let finalParole = originalParole;
    let verdict: GuardianVerdictKind = 'PASS';
    let redeliberationBrief: string | null = null;

    if (safety.triggered && safety.finalParole) {
      verdict = 'OVERRIDE';
      finalParole = safety.finalParole;
      murmures.push('Verdict OVERRIDE — Safety Override autoritaire.');
    } else if (coherence.triggered) {
      verdict = 'RE-DELIBERATE';
      redeliberationBrief = coherence.redeliberationBrief;
      murmures.push('Verdict RE-DELIBERATE — aligner Majordome sur Enquêteur.');
    } else if (social.triggered && social.finalParole) {
      verdict = 'OVERRIDE';
      finalParole = social.finalParole;
      murmures.push('Verdict OVERRIDE — protection sociale Marie.');
    } else {
      murmures.push('Verdict PASS — parole transmise sans correction.');
    }

    for (const m of murmures) {
      this.logger.log(`[Gardien] ${m}`);
    }

    const guardianReview: LivingGuardianReview = {
      verdict,
      murmures,
      missionsTriggered,
      reviewedAt: new Date().toISOString(),
      originalParole,
      finalParole,
      redeliberationBrief,
      pendingDoctrineLessons,
    };

    const livingState: LivingBuildingState = {
      ...state,
      guardianReview,
      doctrinePending: pendingDoctrineLessons,
      updatedAt: new Date().toISOString(),
    };

    return {
      verdict,
      murmures,
      missionsTriggered,
      originalParole,
      finalParole,
      redeliberationBrief,
      livingState,
    };
  }
}
