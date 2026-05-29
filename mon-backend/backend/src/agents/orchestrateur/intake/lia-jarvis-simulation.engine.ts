/**
 * Moteur Jarvis — Agent de Raisonnement par Simulation (MISSION_JARVIS.md).
 * Instancie la scène 3D, simule les flux physiques, produit la Consultation Jarvis.
 * Ne s'appuie PAS sur pickJarvisCriticalQuestion ni sur l'ordre du JSON panne.
 */
import { normalizeCompanionLanguage } from '../../shared/lia-dialogue-languages';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import {
  jarvisClosingDoorLock,
  jarvisClosingGeneric,
  jarvisClosingPlumbing,
  jarvisChainPivot,
  jarvisOpeningDoor,
  jarvisOpeningGeneric,
  jarvisOpeningPlumbing,
  jarvisPlumbingPivot,
  jarvisQuestionDoorHinge,
  jarvisQuestionDoorLockClarify,
  jarvisQuestionGeneric,
  jarvisQuestionPlumbingPlug,
  jarvisQuestionPlumbingSupplyDrain,
  jarvisQuestionPlumbingTiming,
  jarvisThanks,
  buildPostIntakeReply,
  signalementSuggestsDoorLock,
} from './lia-jarvis-dialogue.i18n';
import {
  applyChainDiscrimination,
  buildVisualChainHypotheses,
  inferChainMentalModels,
  pickChainQuestion,
  refreshGenericSimulation,
} from './lia-jarvis-visual-chain';
import type { LiaIntakeState } from './lia-intake.service';

export type JarvisFlowKind =
  | 'eau'
  | 'air'
  | 'chaleur'
  | 'mécanique'
  | 'étanchéité'
  | 'signal';

export type JarvisSimulationDomain =
  | 'plumbing_sink'
  | 'carpentry_door'
  | 'roof_envelope'
  | 'electricity'
  | 'generic';

export interface JarvisScene3D {
  /** Guyane tropicale humide par défaut */
  climate: 'tropical_humid' | 'dry_season';
  floorLevel: string | null;
  room: string | null;
  above: string | null;
  below: string | null;
  element: string | null;
  symptomAnchor: string | null;
}

export interface PhysicalHypothesis {
  id: string;
  label: string;
  /** Ce que Lia « voit » en simulation */
  visualization: string;
  active: boolean;
  confidence: number;
}

export interface JarvisSimulationState {
  domain: JarvisSimulationDomain;
  language: CompanionLanguage;
  scene: JarvisScene3D;
  activeFlows: JarvisFlowKind[];
  mentalModels: string[];
  hypotheses: PhysicalHypothesis[];
  /** Discriminateurs déjà tranchés (timing, supply_vs_drain, hinge_vs_floor…) */
  resolvedSteps: string[];
  intakeComplete: boolean;
  visualizationSummary: string;
}

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function fullContext(
  title: string,
  description: string,
  message = '',
): string {
  return norm(`${title} ${description} ${message}`);
}

function detectDomain(ctx: string): JarvisSimulationDomain {
  if (
    (/porte/.test(ctx) &&
      /(ferme pas|ne ferme|coinc|bloqu|accroch|frotte|gonfl|affaiss)/.test(ctx)) ||
    (/gache|gâche|serrure|poignee|poignée|penture|targette|verrou|cremone|crémone/.test(
      ctx,
    ) &&
      /porte|entree|entrée|chambre/.test(ctx))
  ) {
    return 'carpentry_door';
  }
  if (
    /fuite|eau|coule|goutte|plomb|evier|évier|lavabo|siphon|flexible|robinet|dlo|bokit/.test(
      ctx,
    )
  ) {
    return 'plumbing_sink';
  }
  if (/toit|toiture|infiltr|plafond|goutti|facade|façade|pluie/.test(ctx)) {
    return 'roof_envelope';
  }
  if (/electri|disjoncteur|lumi|ampoule|compteur|courant/.test(ctx)) {
    return 'electricity';
  }
  return 'generic';
}

/** Permet de basculer hors « générique » quand le locataire précise le sujet dans le fil. */
function resolveSimulationDomain(
  prior: JarvisSimulationState | null | undefined,
  ctx: string,
): JarvisSimulationDomain {
  const detected = detectDomain(ctx);
  if (!prior?.domain || prior.domain === 'generic') {
    return detected;
  }
  if (detected !== 'generic' && detected !== prior.domain) {
    return detected;
  }
  return prior.domain;
}

function inferScene(ctx: string, domain: JarvisSimulationDomain): JarvisScene3D {
  const climate =
    /saison seche|sec|canicule/.test(ctx) ? 'dry_season' : 'tropical_humid';

  let floorLevel: string | null = null;
  if (/rdc|rez|plain.?pied|0 etage|0ème/.test(ctx)) floorLevel = 'RDC';
  else if (/r\+1|1er etage|premier etage/.test(ctx)) floorLevel = 'R+1';
  else if (/r\+2|2e etage|deuxieme etage/.test(ctx)) floorLevel = 'R+2';
  else if (/r\+6|dernier etage|toiture terrasse/.test(ctx)) floorLevel = 'R+6';

  let room: string | null = null;
  if (/cuisine/.test(ctx)) room = 'cuisine';
  else if (/salle de bain|sdb/.test(ctx)) room = 'salle de bain';
  else if (/chambre/.test(ctx)) room = 'chambre';
  else if (/salon/.test(ctx)) room = 'salon';
  else if (/couloir/.test(ctx)) room = 'couloir';
  else if (/entree|entrée|palier/.test(ctx)) room = 'entrée';

  let above: string | null = null;
  let below: string | null = null;
  if (/commerce|pharmacie|local commercial/.test(ctx)) below = 'commerce / local R-1';
  if (/toit|toiture|terrasse/.test(ctx)) above = 'toiture / terrasse';
  if (floorLevel === 'R+1' && !below) below = 'plafond du niveau inférieur (dalle)';

  let element: string | null = null;
  let symptomAnchor: string | null = null;

  if (domain === 'plumbing_sink') {
    element = /wc|toilet/.test(ctx) ? 'WC' : /lavabo/.test(ctx) ? 'lavabo' : 'évier';
    if (/sous.*(evier|évier|lavabo)|fuit.*sous|dessous|endessous|anba/.test(ctx)) {
      symptomAnchor = `sous l’${element}`;
    } else if (/robinet|mitigeur|flexible/.test(ctx)) {
      symptomAnchor = 'au robinet / flexible';
    }
  }

  if (domain === 'carpentry_door') {
    element = 'porte';
    if (/gache|gâche/.test(ctx)) symptomAnchor = 'gâche / serrure';
    else if (/frotte|sol|bas/.test(ctx)) symptomAnchor = 'bas de porte / sol';
    else symptomAnchor = 'fermeture / cadre';
  }

  if (domain === 'generic' && /\btv\b|television|t[eé]l[eé]vision/.test(ctx)) {
    element = 'téléviseur';
    symptomAnchor = /aucun signal|pas de signal/.test(ctx)
      ? 'écran « aucun signal »'
      : 'réception / chaînes';
  }

  return {
    climate,
    floorLevel,
    room,
    above,
    below,
    element,
    symptomAnchor,
  };
}

function buildHypotheses(
  domain: JarvisSimulationDomain,
  ctx: string,
): PhysicalHypothesis[] {
  if (domain === 'carpentry_door') {
    return [
      {
        id: 'hinge_sag',
        label: 'Gonds affaissés — porte qui tire vers le bas',
        visualization:
          'Je visualise la porte qui s’affaisse sur ses gonds : le bas frotte le sol, le pêne ne rentre plus dans la gâche.',
        active: true,
        confidence: 0.45,
      },
      {
        id: 'floor_swell',
        label: 'Sol ou dalle qui gonfle (humidité / enveloppe)',
        visualization:
          'Je visualise le sol ou le cadre qui gonfle légèrement — effet humidité ou infiltration lente — la porte coince en bas.',
        active: true,
        confidence: 0.35,
      },
      {
        id: 'lock_misalign',
        label: 'Gâche ou serrure désalignée',
        visualization:
          'Je visualise la serrure qui accroche : le pêne et la gâche ne sont plus face à face.',
        active: /gache|gâche|serrure|accroch|targette/.test(ctx),
        confidence: 0.4,
      },
      {
        id: 'frame_warp',
        label: 'Cadre de porte déformé (humidité chronique)',
        visualization:
          'Je visualise le cadre qui a pris l’humidité et se déforme — porte qui frotte sur le montant.',
        active: /humid|moisi|gonfl|infiltr/.test(ctx),
        confidence: 0.25,
      },
    ].filter((h) => h.active);
  }

  if (domain === 'plumbing_sink') {
    const underFixture =
      /sous.*(evier|évier|lavabo)|anba|fuit.*sous|dessous|endessous/.test(ctx);
    return [
      {
        id: 'supply_flexible',
        label: 'Flexible ou alimentation (amont) — fuite à l’usage',
        visualization:
          'Je visualise le flexible ou le joint de mitigeur sous l’évier : l’eau sort quand le robinet est ouvert.',
        active: true,
        confidence: underFixture ? 0.42 : 0.3,
      },
      {
        id: 'drain_siphon',
        label: 'Siphon, bonde ou évacuation (aval local)',
        visualization:
          'Je visualise le siphon ou la bonde : l’eau fuit quand l’évier se vide, pas quand il est bouché.',
        active: true,
        confidence: underFixture ? 0.38 : 0.28,
      },
      {
        id: 'continuous_leak',
        label: 'Fuite continue (robinet qui goutte / flexible sous pression)',
        visualization:
          'Je visualise une goutte permanente sous l’évier, même robinet fermé.',
        active: true,
        confidence: 0.2,
      },
      {
        id: 'roof_infiltration',
        label: 'Infiltration toiture / enveloppe (pluie)',
        visualization:
          'Je visualise l’enveloppe du bâtiment — seulement si la fuite n’est pas liée à l’usage du point d’eau.',
        active: !underFixture,
        confidence: underFixture ? 0.05 : 0.25,
      },
    ].filter((h) => h.active);
  }

  if (domain === 'generic') {
    const flows = inferFlows(domain, ctx);
    const scene = inferScene(ctx, domain);
    return buildVisualChainHypotheses(flows, ctx, scene);
  }

  return [
    {
      id: 'generic_observe',
      label: 'Observation terrain requise',
      visualization: 'Je visualise le logement et les flux décrits dans votre signalement.',
      active: true,
      confidence: 0.5,
    },
  ];
}

function inferFlows(domain: JarvisSimulationDomain, ctx: string): JarvisFlowKind[] {
  const flows = new Set<JarvisFlowKind>();
  if (domain === 'plumbing_sink' || /eau|fuit|coule|dlo/.test(ctx)) flows.add('eau');
  if (domain === 'carpentry_door') flows.add('mécanique');
  if (
    /\btv\b|television|tnt|antenne|decodeur|d[eé]codeur|box|chaine|signal|r[eé]ception/.test(
      ctx,
    )
  ) {
    flows.add('signal');
  }
  if (/humid|moisi|condens|vmc/.test(ctx)) flows.add('air');
  if (/chauff|radiateur|clim|froid|chaleur/.test(ctx)) flows.add('chaleur');
  if (domain === 'roof_envelope' || /infiltr|toit|facade/.test(ctx)) {
    flows.add('étanchéité');
    flows.add('eau');
  }
  if (flows.size === 0) flows.add('mécanique');
  return [...flows];
}

function inferMentalModels(
  domain: JarvisSimulationDomain,
  scene: JarvisScene3D,
  ctx: string,
): string[] {
  const models: string[] = [];
  if (domain === 'plumbing_sink') {
    models.push('Exutoire (3 verres) — ici : zoom amont / logement / aval local sous l’évier');
  }
  if (domain === 'carpentry_door') {
    models.push('Mécanique — porte, gonds, gâche (priorité serrure si clé bloquée)');
  }
  if (domain === 'generic') {
    return inferChainMentalModels(inferFlows(domain, ctx));
  }
  if (domain === 'carpentry_door' && (scene.below || /humid|moisi|gonfl/.test(ctx))) {
    models.push('Enveloppe — humidité chronique peut gonfler cadre ou sol');
  }
  if (scene.below?.includes('commerce')) {
    models.push('Dalle froide — local froid en R-1 → condensation possible au-dessus');
  }
  if (domain === 'roof_envelope') {
    models.push('Enveloppe percée — toiture / façade → intérieur');
  }
  return models;
}

function mergePriorHypotheses(
  fresh: PhysicalHypothesis[],
  prior: PhysicalHypothesis[] | undefined,
): PhysicalHypothesis[] {
  if (!prior?.length) return fresh;
  const priorById = new Map(prior.map((h) => [h.id, h]));
  return fresh.map((h) => {
    const prev = priorById.get(h.id);
    if (!prev) return h;
    return { ...h, active: prev.active, confidence: prev.confidence };
  });
}

function isNegativeReply(msg: string): boolean {
  return (
    /\b(non|nan|pas|pa\b|aucun|jamais)\b/.test(msg) || /\bne .{0,48} pas\b/.test(msg)
  );
}

function mentionsDoorBottom(msg: string): boolean {
  return /\b(bas|sol|par terre|en bas)\b/.test(msg) || /frott.*sol|sol.*frott/.test(msg);
}

function mentionsDoorTop(msg: string): boolean {
  return /\b(haut|cadre|montant|en haut)\b/.test(msg) || /bloqu.*cadre|cadre.*bloqu/.test(msg);
}

function applyCarpentryDiscriminators(
  msg: string,
  resolved: string[],
  hypotheses: PhysicalHypothesis[],
  deactivate: (id: string) => void,
): { resolved: string[]; hypotheses: PhysicalHypothesis[]; intakeComplete: boolean } {
  let intakeComplete = false;
  let hypos = hypotheses;

  const keyTurnIssue =
    /cl[eé]s?\b|clef|tourner|verrouill|serrure|pe[cç]ne|gache|gâche|targette|accroch/.test(
      msg,
    ) &&
    (/tourner|verrouill|arrive pas|n.arrive|bloqu.*cl|coinc.*cl|pas.*tourner|ne .*tourner/.test(
      msg,
    ) ||
      /ferme (bien|correctement|normalement)|impossible.*verrouill|ferme mais/.test(
        msg,
      ) ||
      /pe[cç]ne.*rentre.*pas|rentre.*pas.*gache|rentre.*pas.*gâche/.test(msg));

  if (keyTurnIssue) {
    if (!resolved.includes('lock_focus')) resolved.push('lock_focus');
    deactivate('hinge_sag');
    deactivate('floor_swell');
    deactivate('frame_warp');
    hypos = hypos.map((h) =>
      h.id === 'lock_misalign'
        ? { ...h, active: true, confidence: Math.min(h.confidence + 0.35, 0.95) }
        : h,
    );
    intakeComplete = true;
    return { resolved, hypotheses: hypos, intakeComplete };
  }

  const answersHingeQuestion =
    /frott|bloqu|coinc/.test(msg) && (mentionsDoorBottom(msg) || mentionsDoorTop(msg));

  if (answersHingeQuestion) {
    if (!resolved.includes('hinge_vs_floor')) resolved.push('hinge_vs_floor');
    const neg = isNegativeReply(msg);

    if (mentionsDoorBottom(msg)) {
      if (neg) {
        deactivate('hinge_sag');
        deactivate('floor_swell');
      } else {
        deactivate('lock_misalign');
        hypos = hypos.map((h) =>
          h.id === 'hinge_sag' || h.id === 'floor_swell'
            ? { ...h, confidence: h.confidence + 0.2 }
            : h,
        );
      }
    }

    if (mentionsDoorTop(msg)) {
      if (neg) {
        deactivate('frame_warp');
      } else {
        deactivate('hinge_sag');
        deactivate('floor_swell');
        hypos = hypos.map((h) =>
          h.id === 'frame_warp' || h.id === 'lock_misalign'
            ? { ...h, confidence: h.confidence + 0.2 }
            : h,
        );
      }
    }

    if (!neg && mentionsDoorBottom(msg) && mentionsDoorTop(msg)) {
      deactivate('lock_misalign');
    }

    intakeComplete = true;
  }

  if (/bloqu|plus du tout|ne ferme plus du tout|coince complet/.test(msg)) {
    resolved.push('severity');
  }

  return { resolved, hypotheses: hypos, intakeComplete };
}

/** Met à jour la simulation selon les réponses locataire (discrimination physique). */
function applyDiscriminators(
  sim: JarvisSimulationState,
  messageCtx: string,
): JarvisSimulationState {
  const msg = norm(messageCtx);
  const resolved = [...sim.resolvedSteps];
  let hypotheses = sim.hypotheses.map((h) => ({ ...h }));
  let intakeComplete = sim.intakeComplete;

  const deactivate = (id: string) => {
    hypotheses = hypotheses.map((h) =>
      h.id === id ? { ...h, active: false, confidence: 0 } : h,
    );
  };

  if (sim.domain === 'plumbing_sink') {
    const underFixture = Boolean(sim.scene.symptomAnchor?.includes('sous'));

    if (/continu|permanent|tout le temps|meme robinet ferme|même fermé|toujours/.test(msg)) {
      if (!resolved.includes('timing')) resolved.push('timing');
      deactivate('drain_siphon');
      deactivate('roof_infiltration');
    }

    if (
      /utilis|ouvr|ouvre|mitigeur|robinet|quand j|kan m|leve dlo/.test(msg) &&
      !/evacu|vid|se vide|coule dans|bonde|siphon/.test(msg)
    ) {
      if (!resolved.includes('timing')) resolved.push('timing');
      deactivate('continuous_leak');
      deactivate('roof_infiltration');
    }

    if (/evacu|vid|se vide|s.?écoule|coule dans|bonde|siphon|debarras/.test(msg)) {
      if (!resolved.includes('supply_vs_drain')) resolved.push('supply_vs_drain');
      deactivate('supply_flexible');
      deactivate('continuous_leak');
    }

    if (
      /ouvr.*eau|mitigeur|robinet|eau chaude|eau froide|coule quand/.test(msg) &&
      !/evacu|vid/.test(msg)
    ) {
      if (!resolved.includes('supply_vs_drain')) resolved.push('supply_vs_drain');
      deactivate('drain_siphon');
      deactivate('roof_infiltration');
    }

    if (/bouchon|bouch|plug|obtur/.test(msg)) {
      resolved.push('plug_test');
    }

    if (/non.*pluie|pas.*pluie|pas lie.*pluie|pas quand il pleut/.test(msg)) {
      deactivate('roof_infiltration');
    }

    const supplyPath =
      resolved.includes('supply_vs_drain') &&
      hypotheses.some((h) => h.id === 'supply_flexible' && h.active);
    if (underFixture && supplyPath && resolved.includes('plug_test')) {
      intakeComplete = true;
    }
    if (
      underFixture &&
      resolved.includes('supply_vs_drain') &&
      hypotheses.some((h) => h.id === 'drain_siphon' && !h.active) &&
      !supplyPath
    ) {
      intakeComplete = true;
    }
  }

  if (sim.domain === 'carpentry_door') {
    const carp = applyCarpentryDiscriminators(msg, resolved, hypotheses, deactivate);
    resolved.splice(0, resolved.length, ...carp.resolved);
    hypotheses = carp.hypotheses;
    if (carp.intakeComplete) intakeComplete = true;
  }

  let nextSim: JarvisSimulationState = {
    ...sim,
    hypotheses,
    resolvedSteps: resolved,
    intakeComplete,
    visualizationSummary: buildVisualizationSummary(
      hypotheses.filter((h) => h.active),
      sim.scene,
    ),
  };

  if (sim.domain === 'generic') {
    nextSim = applyChainDiscrimination(nextSim, messageCtx);
  }

  return nextSim;
}

function buildVisualizationSummary(
  hypos: PhysicalHypothesis[],
  scene: JarvisScene3D,
): string {
  const top = [...hypos].sort((a, b) => b.confidence - a.confidence).slice(0, 2);
  const parts = top.map((h) => h.visualization);
  if (scene.symptomAnchor) {
    parts.unshift(`Ancrage : ${scene.symptomAnchor}`);
  }
  return parts.join(' · ');
}

function pickPhysicalQuestion(
  sim: JarvisSimulationState,
  signalementCtx: string,
): string | null {
  if (sim.intakeComplete) return null;

  const lang = sim.language;

  if (sim.domain === 'plumbing_sink') {
    if (!sim.resolvedSteps.includes('timing')) {
      return jarvisQuestionPlumbingTiming(lang);
    }
    if (!sim.resolvedSteps.includes('supply_vs_drain')) {
      return jarvisQuestionPlumbingSupplyDrain(lang);
    }
    if (!sim.resolvedSteps.includes('plug_test')) {
      const active = sim.hypotheses.find(
        (h) => h.active && h.id === 'supply_flexible',
      );
      if (active) {
        return jarvisQuestionPlumbingPlug(lang);
      }
    }
    return null;
  }

  if (sim.domain === 'carpentry_door') {
    if (sim.resolvedSteps.includes('lock_focus')) return null;
    if (
      signalementSuggestsDoorLock(signalementCtx) &&
      sim.resolvedSteps.length === 0
    ) {
      return jarvisQuestionDoorLockClarify(lang);
    }
    if (!sim.resolvedSteps.includes('hinge_vs_floor')) {
      return jarvisQuestionDoorHinge(lang);
    }
    return null;
  }

  if (sim.domain === 'generic') {
    const chainQ = pickChainQuestion(sim, lang);
    if (chainQ) return chainQ;
  }

  return jarvisQuestionGeneric(lang);
}

/** Langue de dialogue — choix explicite du locataire (pas de miroir auto sur le texte). */
export function resolveJarvisDialogueLanguage(params: {
  preferredLanguage?: string;
  prior?: JarvisSimulationState | null;
}): CompanionLanguage {
  if (params.preferredLanguage) {
    return normalizeCompanionLanguage(params.preferredLanguage);
  }
  if (params.prior?.language) {
    return params.prior.language;
  }
  return 'fr';
}

export function runJarvisSimulation(params: {
  title: string;
  description: string;
  message?: string;
  prior?: JarvisSimulationState | null;
  preferredLanguage?: string;
}): JarvisSimulationState {
  const ctx = fullContext(params.title, params.description, params.message ?? '');
  const language = resolveJarvisDialogueLanguage({
    preferredLanguage: params.preferredLanguage,
    prior: params.prior,
  });

  const domain = resolveSimulationDomain(params.prior, ctx);
  const domainChanged = Boolean(
    params.prior?.domain && params.prior.domain !== domain,
  );
  const scene =
    params.prior && !domainChanged
      ? params.prior.scene
      : inferScene(ctx, domain);
  const activeFlows = inferFlows(domain, ctx);
  const mentalModels = inferMentalModels(domain, scene, ctx);
  let hypotheses = domainChanged
    ? buildHypotheses(domain, ctx)
    : mergePriorHypotheses(buildHypotheses(domain, ctx), params.prior?.hypotheses);

  let sim: JarvisSimulationState = {
    domain,
    language,
    scene,
    activeFlows,
    mentalModels,
    hypotheses,
    resolvedSteps: domainChanged ? [] : (params.prior?.resolvedSteps ?? []),
    intakeComplete: domainChanged ? false : (params.prior?.intakeComplete ?? false),
    visualizationSummary: '',
  };

  sim.visualizationSummary = buildVisualizationSummary(
    hypotheses.filter((h) => h.active),
    scene,
  );

  if (domain === 'generic') {
    sim = refreshGenericSimulation(sim, ctx);
  }

  if (params.message?.trim()) {
    sim = applyDiscriminators(sim, params.message.trim());
  } else if (params.prior) {
    sim = {
      ...sim,
      resolvedSteps: params.prior.resolvedSteps,
      intakeComplete: params.prior.intakeComplete,
    };
  }

  return sim;
}

export interface JarvisConsultation {
  acknowledgment: string;
  nextQuestion: string | null;
  visualizationNote: string;
  intakeComplete: boolean;
  language: CompanionLanguage;
}

/** Consultation Jarvis : parole locataire (sans pensées internes — celles-ci restent en console). */
export function buildJarvisConsultation(params: {
  simulation: JarvisSimulationState;
  title: string;
  description: string;
  tenantFirstName?: string;
  mode: 'opening' | 'tenant_turn';
  /** Dossier déjà transmis — ne pas répéter le message de clôture. */
  postIntake?: boolean;
  message?: string;
  lastAcknowledgment?: string;
}): JarvisConsultation {
  const name = params.tenantFirstName?.trim() || 'Bonjour';
  const lang = params.simulation.language;
  const sim = params.simulation;
  const lieu = sim.scene.room ? ` (${sim.scene.room})` : '';
  const signalementCtx = fullContext(params.title, params.description);

  let acknowledgment = '';

  if (params.mode === 'opening') {
    if (sim.domain === 'carpentry_door') {
      acknowledgment = jarvisOpeningDoor(name, lieu, lang);
    } else if (sim.domain === 'plumbing_sink') {
      const anchor = sim.scene.symptomAnchor ?? 'au point d’eau';
      acknowledgment = jarvisOpeningPlumbing(name, anchor, lang);
    } else {
      acknowledgment = jarvisOpeningGeneric(name, lang);
    }
  } else if (sim.intakeComplete) {
    if (params.postIntake && params.message?.trim()) {
      acknowledgment = buildPostIntakeReply({
        message: params.message,
        name,
        lang,
        domain: sim.domain,
        lastAck: params.lastAcknowledgment,
      });
    } else if (sim.domain === 'carpentry_door') {
      acknowledgment = jarvisClosingDoorLock(name, lang);
    } else if (sim.domain === 'plumbing_sink') {
      acknowledgment = jarvisClosingPlumbing(name, lang);
    } else {
      acknowledgment = jarvisClosingGeneric(name, lang);
    }
  } else {
    acknowledgment = jarvisThanks(name, lang);
    if (sim.domain === 'plumbing_sink' && sim.resolvedSteps.includes('timing')) {
      acknowledgment += jarvisPlumbingPivot(lang);
    }
    if (
      sim.domain === 'generic' &&
      sim.hypotheses.some((h) => h.active && h.id.startsWith('chain_'))
    ) {
      acknowledgment += jarvisChainPivot(lang);
    }
  }

  const nextQuestion = pickPhysicalQuestion(sim, signalementCtx);

  return {
    acknowledgment: acknowledgment.trim(),
    nextQuestion,
    visualizationNote: sim.visualizationSummary,
    intakeComplete: sim.intakeComplete && !nextQuestion,
    language: lang,
  };
}

export function parseSimulationFromState(
  state: LiaIntakeState,
): JarvisSimulationState | null {
  const raw = state.jarvisFacts?.jarvis_simulation;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JarvisSimulationState;
  } catch {
    return null;
  }
}

export function attachSimulationToState(
  state: LiaIntakeState,
  simulation: JarvisSimulationState,
): LiaIntakeState {
  return {
    ...state,
    preferredLanguage: simulation.language,
    jarvisFacts: {
      ...(state.jarvisFacts ?? {}),
      jarvis_simulation: JSON.stringify(simulation),
      visualization: simulation.visualizationSummary,
      liaison_langue: simulation.language,
      locataire_langue: simulation.language,
      ...(simulation.scene.element
        ? { equipement: simulation.scene.element }
        : {}),
      ...(simulation.scene.symptomAnchor
        ? { localisation: simulation.scene.symptomAnchor }
        : {}),
    },
  };
}

export function syncJarvisSimulationOnState(
  state: LiaIntakeState,
  title: string,
  description: string,
  message = '',
): LiaIntakeState {
  const prior = parseSimulationFromState(state);
  const simulation = runJarvisSimulation({
    title,
    description,
    message,
    prior,
    preferredLanguage: state.preferredLanguage,
  });
  return attachSimulationToState(state, simulation);
}

export function isSimulationIntakeComplete(state: LiaIntakeState): boolean {
  const sim = parseSimulationFromState(state);
  return sim?.intakeComplete === true;
}
