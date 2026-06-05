/**
 * Conscience professionnelle Niveau 5 — protection sociale + rigueur Enquêteur.
 * MISSION_JARVIS · VISUAL_LOGIC · TRADES_CULTURE (force humaine).
 */
import type { LiaTenantSocialContext } from '../../shared/lia-jarvis-identity';
import type {
  LivingBuildingState,
  LivingConsciousnessState,
  LivingTenantProfile,
} from './living-building-state.types';

export const JARVIS_EXPERT_HANDOFF_FR =
  'Cette situation est complexe et nécessite l’œil d’un expert sur place. ' +
  'J’envoie immédiatement votre dossier au technicien référent de votre secteur.';

const PHYSICAL_EFFORT_RE =
  /ampoule|lustre|plafonnier|escabeau|échelle|echelle|monter|grimper|goutti[eè]re|vanne|robinet.*(forcer|serr)|d[eé]bouch|debouch|tableau [eé]lectri|disjoncteur|joint (sous |de )?(evier|évier)|flexible|siphon|peinture|nettoy.*(mur|moisiss)/i;

const DANGEROUS_INSTRUCTION_RE =
  /(?:montez|grimpez|forcez|coupez le disjoncteur|d[eé]bouchez|debouchez|changez l.?ampoule|nettoiez|essayez de r[eé]parer|vous pouvez (couper|forcer|monter))/i;

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Déduit le profil locataire (sénior, PSH, isolement). */
export function resolveTenantProfile(
  state: LivingBuildingState,
  social?: LiaTenantSocialContext | null,
): LivingTenantProfile {
  const reasons: string[] = [];
  const age = social?.ageBand ?? state.humanBarrier.ageBand;
  if (age === 'senior') reasons.push('Sénior');
  if (state.humanBarrier.livesAlone) reasons.push('Vit seule');

  const notes = norm(
    [state.humanBarrier.vulnerabilityNotes, state.signalementDescription]
      .filter(Boolean)
      .join(' '),
  );
  if (/psh|handicap|mobilit[eé] r[eé]duite|fauteuil|aveugle|malvoyant|pmr/.test(notes)) {
    reasons.push('PSH / mobilité réduite');
  }

  const ctx = norm(`${state.signalementTitle} ${state.signalementDescription}`);
  if (/senior|personne [aâ]g[eé]e|retrait[eé]/.test(ctx) && !reasons.includes('Sénior')) {
    reasons.push('Sénior (signalement)');
  }

  return {
    isVulnerable: reasons.length > 0,
    reason: reasons.length ? reasons.join(' · ') : 'Profil standard — autonomie supposée',
  };
}

export function signalementImpliesPhysicalEffort(state: LivingBuildingState): boolean {
  const ctx = norm(
    `${state.signalementTitle} ${state.signalementDescription} ${state.lastTenantMessage ?? ''}`,
  );
  return PHYSICAL_EFFORT_RE.test(ctx);
}

/** Brief injecté Enquêteur + Archiviste quand protection sociale active. */
export function buildSocialProtectionPerception(
  profile: LivingTenantProfile,
  physicalEffort: boolean,
): string {
  if (!profile.isVulnerable) return '';
  return [
    'OVERRIDE PROTECTION SOCIALE (loi suprême — TRADES_CULTURE force humaine) :',
    `Profil : ${profile.reason}.`,
    'Principe de précaution : ne jamais imposer d’effort physique risqué au locataire.',
    physicalEffort
      ? 'Réparation à effort physique détectée → classer PATRIMOINE (charge bailleur) par précaution, même si 87-712 pourrait dire LOCATIF.'
      : 'Sur tout doute charge locative vs bailleur : pencher PATRIMOINE / intervention bailleur si effort ou risque pour le locataire.',
    'Enquêteur : sévérité et urgence bailleur relevées ; pas de consigne d’escalade physique.',
    'Archiviste : inversion de charge automatique si LOCATIF + effort physique.',
  ].join('\n');
}

/** Doute constructif — deux modèles physiques concurrents sans trancher. */
export function detectConstructiveDoubt(state: LivingBuildingState): {
  doubt: boolean;
  competingModels: string[];
  note: string | null;
} {
  const models = state.vision3d.mentalModels.filter(Boolean);
  const flows = state.vision3d.activeFlows.filter(Boolean);
  const activeHypos = state.vision3d.hypotheses.filter((h) => h.active);

  const competing: string[] = [];
  if (models.length >= 2) competing.push(...models.slice(0, 3));
  if (flows.length >= 2 && flows.some((f) => /eau|étanchéit|etancheit/.test(f)) &&
      flows.some((f) => /air|vmc|ventil/.test(f))) {
    competing.push('Flux eau vs flux air — modèles concurrents');
  }

  if (activeHypos.length >= 2) {
    const sorted = [...activeHypos].sort((a, b) => b.confidence - a.confidence);
    const top = sorted[0]?.confidence ?? 0;
    const second = sorted[1]?.confidence ?? 0;
    if (top - second < 0.18 && top < 0.72) {
      competing.push(
        `Hypothèses proches : ${sorted[0]?.label} vs ${sorted[1]?.label}`,
      );
    }
  }

  const doubt = competing.length >= 2 || (activeHypos.length >= 2 && competing.length >= 1);
  const note = doubt
    ? `Doute interne — ne pas figer le diagnostic : ${competing.join(' · ')}`
    : null;

  return { doubt, competingModels: [...new Set(competing)], note };
}

/** Fail-safe Jarvis — impasse ou contradiction physique. */
export function detectExpertHandoffImpasse(
  state: LivingBuildingState,
  doubt: ReturnType<typeof detectConstructiveDoubt>,
): { required: boolean; reason: string | null } {
  const echoes = state.deliberationEchoes.slice(-3);
  const enqInsight = echoes.find((e) => e.agent === 'enqueteur')?.insight ?? '';
  const contradiction =
    /contradict|incohérent|incohérent|impasse|indétermin|impossible de trancher|deux modèles/i.test(
      enqInsight,
    ) ||
    /contradict|incohérent/i.test(state.consciousness?.internalNote ?? '');

  if (contradiction) {
    return {
      required: true,
      reason: 'Simulation physique contradictoire — humilité Jarvis (MISSION_JARVIS §4).',
    };
  }

  if (doubt.doubt && doubt.competingModels.length >= 2 && state.deliberationRound >= 1) {
    const hypos = state.vision3d.hypotheses.filter((h) => h.active);
    const spread =
      hypos.length >= 2
        ? Math.abs((hypos[0]?.confidence ?? 0) - (hypos[1]?.confidence ?? 0))
        : 1;
    if (spread < 0.12) {
      return {
        required: true,
        reason:
          'Doute constructif persistant entre modèles physiques — expert terrain requis.',
      };
    }
  }

  return { required: false, reason: null };
}

function emptyConsciousness(): LivingConsciousnessState {
  return {
    socialProtectionOverride: false,
    socialProtectionNote: null,
    constructiveDoubt: false,
    competingModels: [],
    internalNote: null,
    expertHandoffRequired: false,
    expertHandoffReason: null,
  };
}

/**
 * Applique les deux piliers sur l’état après fusion agents.
 * Console = doute interne ; chat = rassurance (géré par sanitize + Majordome).
 */
export function applyProfessionalConsciousness(
  state: LivingBuildingState,
  social?: LiaTenantSocialContext | null,
): LivingBuildingState {
  const tenantProfile = resolveTenantProfile(state, social);
  const physicalEffort = signalementImpliesPhysicalEffort(state);
  const doubt = detectConstructiveDoubt(state);
  const handoff = detectExpertHandoffImpasse(state, doubt);

  let consciousness: LivingConsciousnessState = {
    ...emptyConsciousness(),
    constructiveDoubt: doubt.doubt,
    competingModels: doubt.competingModels,
    internalNote: doubt.note,
    expertHandoffRequired: handoff.required,
    expertHandoffReason: handoff.reason,
  };

  let next: LivingBuildingState = {
    ...state,
    tenantProfile,
    consciousness,
  };

  if (tenantProfile.isVulnerable) {
    consciousness = {
      ...consciousness,
      socialProtectionOverride: true,
      socialProtectionNote: `Protection sociale active — ${tenantProfile.reason}`,
    };

    if (
      physicalEffort &&
      (next.legalVerdict.chargeHorizon === 'LOCATIF' ||
        next.legalVerdict.chargeHorizon === 'INDETERMINE')
    ) {
      next = {
        ...next,
        legalVerdict: {
          ...next.legalVerdict,
          chargeHorizon: 'PATRIMOINE',
          summary:
            'PATRIMOINE (1719) — override protection sociale : effort physique risqué pour profil vulnérable.',
          tenantChargeExplanation:
            'Par précaution pour votre sécurité, le bailleur prendra en charge l’intervention — vous n’avez pas à effectuer de travaux physiques risqués.',
          afpolGrounding:
            (next.legalVerdict.afpolGrounding ?? '') +
            ' · Override TRADES_CULTURE — force humaine prioritaire sur 87-712.',
        },
        intervention: {
          ...next.intervention,
          readyForDispatch: true,
          urgencyLabel: 'PRIORITAIRE_PROTECTION',
          technicianSummary:
            next.intervention.technicianSummary ??
            `Intervention bailleur — profil vulnérable (${tenantProfile.reason}), pas d’effort locataire.`,
        },
      };
    }

    if (next.safetyLock.severityZone !== 'ZENITH_DANGER') {
      next = {
        ...next,
        safetyLock: {
          ...next.safetyLock,
          severityZone:
            next.safetyLock.severityZone === 'DAWN' ? 'TWILIGHT' : next.safetyLock.severityZone,
        },
      };
    }
  }

  if (consciousness.expertHandoffRequired) {
    next = {
      ...next,
      intervention: {
        ...next.intervention,
        readyForDispatch: true,
        technicianSummary:
          consciousness.expertHandoffReason ??
          'Handoff expert secteur — impasse simulation physique.',
      },
      readiness: 'READY_FOR_TECHNICIAN',
    };
  }

  return {
    ...next,
    consciousness,
    humanBarrier: {
      ...next.humanBarrier,
      extractedFacts: {
        ...next.humanBarrier.extractedFacts,
        profil_vulnerable: tenantProfile.isVulnerable ? 'oui' : 'non',
        protection_sociale: consciousness.socialProtectionOverride ? 'active' : 'non',
        doute_interne: consciousness.constructiveDoubt ? 'oui' : 'non',
      },
    },
  };
}

/** Retire les consignes d’action physique dangereuse pour profil fragile (parole externe). */
export function sanitizeTenantMessageForVulnerability(
  message: string,
  state: LivingBuildingState,
): string {
  if (!state.tenantProfile?.isVulnerable) return message;
  if (!DANGEROUS_INSTRUCTION_RE.test(message)) return message;

  const name = state.humanBarrier.displayName || 'Marie';
  const safe =
    `${name}, ne prenez aucun risque — je m’occupe de faire intervenir le bon professionnel. ` +
    'Restez en sécurité, je transmets votre dossier au technicien référent.';

  if (state.consciousness?.expertHandoffRequired) {
    return `${name}, je vous accompagne avec certitude : ${JARVIS_EXPERT_HANDOFF_FR}`;
  }

  return safe;
}

/** Posture externe : certitude et rassurance malgré le doute interne. */
export function buildMajordomeConsciousnessBrief(state: LivingBuildingState): string {
  const lines: string[] = [
    'POSTURE JARVIS — externe (chat) : certitude, rassurance, jamais le doute interne.',
  ];
  if (state.consciousness?.expertHandoffRequired) {
    lines.push(
      `Handoff expert obligatoire — message type (avec assurance) : « ${JARVIS_EXPERT_HANDOFF_FR} »`,
    );
  }
  if (state.tenantProfile?.isVulnerable) {
    lines.push(
      'INTERDIT : demander escabeau, échelle, forcer vanne, déboucher, changer ampoule, couper disjoncteur seul.',
      'Promettre intervention bailleur / technicien si effort physique.',
    );
  }
  if (state.consciousness?.constructiveDoubt) {
    lines.push(
      'Doute interne actif (console seulement) — en chat : parler avec assurance, pas « je ne sais pas ».',
    );
  }
  return lines.join('\n');
}
