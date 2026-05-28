/**
 * Moteur Jarvis — Agent de Raisonnement par Simulation (MISSION_JARVIS.md).
 * Instancie la scène 3D, simule les flux physiques, produit la Consultation Jarvis.
 * Ne s'appuie PAS sur pickJarvisCriticalQuestion ni sur l'ordre du JSON panne.
 */
import { detectLanguageFromTenantText } from '../../shared/lia-tenant-language';
import type { LiaIntakeState } from './lia-intake.service';

export type JarvisFlowKind = 'eau' | 'air' | 'chaleur' | 'mécanique' | 'étanchéité';

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
  language: 'fr' | 'gcf';
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
): string[] {
  const models: string[] = [];
  if (domain === 'plumbing_sink') {
    models.push('Exutoire (3 verres) — ici : zoom amont / logement / aval local sous l’évier');
  }
  if (domain === 'carpentry_door' && (scene.below || /humid|moisi|gonfl/.test(''))) {
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

/** Met à jour la simulation selon les réponses locataire (discrimination physique). */
function applyDiscriminators(
  sim: JarvisSimulationState,
  ctx: string,
): JarvisSimulationState {
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

    if (/continu|permanent|tout le temps|meme robinet ferme|même fermé|toujours/.test(ctx)) {
      if (!resolved.includes('timing')) resolved.push('timing');
      deactivate('drain_siphon');
      deactivate('roof_infiltration');
    }

    if (
      /utilis|ouvr|ouvre|mitigeur|robinet|quand j|kan m|leve dlo/.test(ctx) &&
      !/evacu|vid|se vide|coule dans|bonde|siphon/.test(ctx)
    ) {
      if (!resolved.includes('timing')) resolved.push('timing');
      deactivate('continuous_leak');
      deactivate('roof_infiltration');
    }

    if (/evacu|vid|se vide|s.?écoule|coule dans|bonde|siphon|debarras/.test(ctx)) {
      if (!resolved.includes('supply_vs_drain')) resolved.push('supply_vs_drain');
      deactivate('supply_flexible');
      deactivate('continuous_leak');
    }

    if (
      /ouvr.*eau|mitigeur|robinet|eau chaude|eau froide|coule quand/.test(ctx) &&
      !/evacu|vid/.test(ctx)
    ) {
      if (!resolved.includes('supply_vs_drain')) resolved.push('supply_vs_drain');
      deactivate('drain_siphon');
      deactivate('roof_infiltration');
    }

    if (/bouchon|bouch|plug|obtur/.test(ctx)) {
      resolved.push('plug_test');
    }

    if (/non.*pluie|pas.*pluie|pas lie.*pluie|pas quand il pleut/.test(ctx)) {
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
    if (/bas|sol|frotte.*sol|par terre|en bas/.test(ctx)) {
      if (!resolved.includes('hinge_vs_floor')) resolved.push('hinge_vs_floor');
      deactivate('lock_misalign');
      hypotheses = hypotheses.map((h) =>
        h.id === 'hinge_sag' || h.id === 'floor_swell'
          ? { ...h, confidence: h.confidence + 0.2 }
          : h,
      );
    }
    if (/haut|cadre|montant|en haut|plafond.*porte/.test(ctx)) {
      if (!resolved.includes('hinge_vs_floor')) resolved.push('hinge_vs_floor');
      deactivate('hinge_sag');
      deactivate('floor_swell');
      hypotheses = hypotheses.map((h) =>
        h.id === 'frame_warp' || h.id === 'lock_misalign'
          ? { ...h, confidence: h.confidence + 0.2 }
          : h,
      );
    }
    if (/bloqu|plus du tout|ne ferme plus du tout|coince complet/.test(ctx)) {
      resolved.push('severity');
    }
    if (resolved.includes('hinge_vs_floor')) {
      intakeComplete = true;
    }
  }

  const activeHypos = hypotheses.filter((h) => h.active);
  const visualizationSummary = buildVisualizationSummary(activeHypos, sim.scene);

  return {
    ...sim,
    hypotheses,
    resolvedSteps: resolved,
    intakeComplete,
    visualizationSummary,
  };
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

function pickPhysicalQuestion(sim: JarvisSimulationState): string | null {
  if (sim.intakeComplete) return null;

  const lang = sim.language;

  if (sim.domain === 'plumbing_sink') {
    if (!sim.resolvedSteps.includes('timing')) {
      return lang === 'gcf'
        ? 'A ki moman dlo parèt anba évier-la : tout tan, lè ou ouvè dlo-a, ou lè li vidé ?'
        : 'À quel moment l’eau apparaît-elle sous l’évier : en permanence, quand vous ouvrez l’eau, ou surtout quand l’évier se vide ?';
    }
    if (!sim.resolvedSteps.includes('supply_vs_drain')) {
      return lang === 'gcf'
        ? 'Lè ou ouvè mitigè-a évier-la vidé toujou, ou sé lè dlo ap koule épi li vidé ?'
        : 'L’eau sort-elle surtout quand vous ouvrez le mitigeur, ou quand l’évier se vide (évacuation) ?';
    }
    if (!sim.resolvedSteps.includes('plug_test')) {
      const active = sim.hypotheses.find(
        (h) => h.active && h.id === 'supply_flexible',
      );
      if (active) {
        return lang === 'gcf'
          ? 'Ou ka mete yon bouchon nan évier-la, ouvè dlo-a, épi di m si li toujou koule anba ?'
          : 'Pouvez-vous mettre un bouchon dans l’évier, rouvrir l’eau, et me dire si ça fuit encore dessous ?';
      }
    }
    return null;
  }

  if (sim.domain === 'carpentry_door') {
    if (!sim.resolvedSteps.includes('hinge_vs_floor')) {
      return lang === 'gcf'
        ? 'Lè ou pouse pòt-la, li frotté anba sou sol-la, ou li bloke anlè nan kad-la ?'
        : 'Quand vous poussez la porte, frotte-t-elle en bas contre le sol, ou bloque-t-elle plutôt en haut du cadre ?';
    }
    return null;
  }

  return lang === 'gcf'
    ? 'Ka ou di m plis sou sa ou wè, san repété tout ?'
    : 'Pouvez-vous préciser ce que vous observez, sans tout répéter ?';
}

export function runJarvisSimulation(params: {
  title: string;
  description: string;
  message?: string;
  prior?: JarvisSimulationState | null;
  preferredLanguage?: string;
}): JarvisSimulationState {
  const ctx = fullContext(params.title, params.description, params.message ?? '');
  const langFromText = detectLanguageFromTenantText(
    params.message ?? '',
    params.title,
    params.description,
  );
  const language: 'fr' | 'gcf' =
    params.preferredLanguage === 'gcf' || langFromText === 'gcf' ? 'gcf' : 'fr';

  const domain = params.prior?.domain ?? detectDomain(ctx);
  const scene = inferScene(ctx, domain);
  const activeFlows = inferFlows(domain, ctx);
  const mentalModels = inferMentalModels(domain, scene);
  let hypotheses = buildHypotheses(domain, ctx);

  let sim: JarvisSimulationState = {
    domain,
    language,
    scene,
    activeFlows,
    mentalModels,
    hypotheses,
    resolvedSteps: params.prior?.resolvedSteps ?? [],
    intakeComplete: false,
    visualizationSummary: '',
  };

  sim.visualizationSummary = buildVisualizationSummary(
    hypotheses.filter((h) => h.active),
    scene,
  );

  if (params.message?.trim()) {
    sim = applyDiscriminators(sim, ctx);
  } else if (params.prior) {
    sim = { ...sim, resolvedSteps: params.prior.resolvedSteps, intakeComplete: params.prior.intakeComplete };
  }

  return sim;
}

export interface JarvisConsultation {
  acknowledgment: string;
  nextQuestion: string | null;
  visualizationNote: string;
  intakeComplete: boolean;
  language: 'fr' | 'gcf';
}

/** Consultation Jarvis : empathie + reformulation + visualisation + question physique. */
export function buildJarvisConsultation(params: {
  simulation: JarvisSimulationState;
  title: string;
  description: string;
  tenantFirstName?: string;
  mode: 'opening' | 'tenant_turn';
}): JarvisConsultation {
  const name = params.tenantFirstName?.trim() || 'Bonjour';
  const lang = params.simulation.language;
  const ctx = fullContext(params.title, params.description);
  const sim = params.simulation;
  const topHypos = sim.hypotheses
    .filter((h) => h.active)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);

  let empathy =
    lang === 'gcf'
      ? `${name}, mwen tande ou. Mwen li sa ou écri épi mwen pa kay fè ou répété.`
      : `${name}, je vous entends. J’ai bien lu votre signalement et je ne vous ferai pas répéter ce que vous avez déjà précisé.`;

  let reformulation = '';
  let visualization = '';

  if (sim.domain === 'carpentry_door') {
    const element = sim.scene.symptomAnchor ?? 'la fermeture de la porte';
    const lieu = sim.scene.room ? ` (${sim.scene.room})` : '';
    reformulation =
      lang === 'gcf'
        ? ` Ou di m : pòt-la pa fèmen kòrèkteman${lieu}.`
        : ` Vous me dites : la porte ne ferme plus correctement${lieu}.`;
    const vizParts = topHypos.map((h) => h.visualization);
    visualization =
      lang === 'gcf'
        ? ` Mwen vizualizé : ${vizParts.join(' Oswa ')}`
        : ` En visualisant la scène : ${vizParts.join(' — ou ')}`;
  } else if (sim.domain === 'plumbing_sink') {
    const anchor = sim.scene.symptomAnchor ?? 'au point d’eau';
    const el = sim.scene.element ?? 'évier';
    reformulation =
      lang === 'gcf'
        ? ` Ou gen yon fuite dlo ${anchor === `sous l’${el}` ? `anba ${el}-la` : anchor}.`
        : ` Vous signalez une fuite d’eau ${anchor}.`;
    visualization =
      lang === 'gcf'
        ? ` Mwen vizualizé poste dlo-a — mitigè, flexib, siphon anba ${el}-la.`
        : ` Je visualise le poste d’eau — mitigeur, flexibles, siphon sous l’${el} — pas le toit pour l’instant.`;
  } else {
    reformulation =
      lang === 'gcf'
        ? ` Mwen pran an kont sa ou di.`
        : ` Je retiens ce que vous décrivez.`;
    visualization = ` ${sim.visualizationSummary}`;
  }

  if (params.mode === 'tenant_turn' && sim.resolvedSteps.includes('timing')) {
    empathy =
      lang === 'gcf'
        ? `${name}, mèsi pou presizyon-an.`
        : `${name}, merci pour cette précision.`;
    if (sim.domain === 'plumbing_sink' && !sim.resolvedSteps.includes('supply_vs_drain')) {
      visualization =
        lang === 'gcf'
          ? ' Mwen éliminé fuite ki pa sispann — ann nou wè si sé mitigè ou vidaj.'
          : ' J’écarte une fuite permanente ou la pluie — restons sur l’usage du point d’eau.';
    }
  }

  const nextQuestion = pickPhysicalQuestion(sim);
  const acknowledgment = `${empathy}${reformulation}${visualization}`.trim();

  return {
    acknowledgment,
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
