/**
 * Raisonnement Jarvis — même méthode pour tout sujet nouveau.
 * Modèle Exutoire / chaîne : amont → logement → poste local (VISUAL_LOGIC.md).
 * Pas de domaine codé par type de panne : on compare les hypothèses actives.
 */
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import { jarvisChainCompareQuestion, jarvisChainScopeQuestion } from './lia-jarvis-dialogue.i18n';
import { applyClinicalLinkEffects } from './lia-savoir-clinical-links.loader';
import type { HousingKind } from './lia-housing-perspective';
import type {
  JarvisFlowKind,
  JarvisScene3D,
  JarvisSimulationState,
  PhysicalHypothesis,
} from './lia-jarvis-simulation.engine';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Hypothèses dérivées des flux détectés — pas d’arbre par métier. */
export function buildVisualChainHypotheses(
  flows: JarvisFlowKind[],
  ctx: string,
  scene: JarvisScene3D,
): PhysicalHypothesis[] {
  const hypos: PhysicalHypothesis[] = [];
  const element = scene.element ?? 'équipement';

  if (flows.includes('signal')) {
    hypos.push(
      {
        id: 'chain_signal_amont',
        label: 'Amont — antenne, box ou réseau opérateur',
        visualization:
          'Je visualise l’amont du signal : antenne, box ou réseau avant le logement.',
        active: true,
        confidence: /box|decodeur|d[eé]codeur|internet|tnt|antenne/.test(ctx)
          ? 0.42
          : 0.35,
      },
      {
        id: 'chain_signal_liaison',
        label: 'Logement — câbles, prises, décodeur',
        visualization:
          'Je visualise la liaison dans le logement : câble, prise murale, HDMI, décodeur.',
        active: true,
        confidence: 0.33,
      },
      {
        id: 'chain_signal_local',
        label: 'Poste local — une TV ou une prise',
        visualization:
          'Je visualise une panne localisée sur un seul poste (TV, prise ou câble).',
        active: true,
        confidence: /une seule|seulement|cette tv|sur la tv/.test(ctx) ? 0.45 : 0.28,
      },
    );
  }

  if (flows.includes('eau') && !flows.includes('signal')) {
    hypos.push(
      {
        id: 'chain_eau_amont',
        label: 'Amont — colonne, toiture, réseau bailleur',
        visualization:
          'Je visualise l’amont hydraulique : ce qui arrive avant le logement (colonne, toiture).',
        active: true,
        confidence: 0.3,
      },
      {
        id: 'chain_eau_logement',
        label: `Logement — ${element} / usage local`,
        visualization: `Je visualise le point d’eau ou l’${element} dans le logement.`,
        active: true,
        confidence: 0.4,
      },
      {
        id: 'chain_eau_aval',
        label: 'Aval / exutoire — évacuation, refoulement',
        visualization:
          'Je visualise l’exutoire : évacuation, siphon, refoulement — la sortie du système.',
        active: true,
        confidence: 0.28,
      },
    );
  }

  if (flows.includes('air') && hypos.length === 0) {
    hypos.push(
      {
        id: 'chain_air_enveloppe',
        label: 'Enveloppe — toiture, façade, infiltration',
        visualization:
          'Je visualise l’enveloppe du bâtiment : humidité ou air qui entre de l’extérieur.',
        active: true,
        confidence: /toit|infiltr|facade|pluie/.test(ctx) ? 0.42 : 0.3,
      },
      {
        id: 'chain_air_logement',
        label: 'Logement — VMC, pièce, condensation',
        visualization:
          'Je visualise l’air dans le logement : VMC, pièce humide, condensation locale.',
        active: true,
        confidence: /vmc|condens|moisi|humid/.test(ctx) ? 0.45 : 0.35,
      },
    );
  }

  if (hypos.length === 0) {
    hypos.push({
      id: 'generic_observe',
      label: 'Observation terrain requise',
      visualization: 'Je visualise le logement et les flux décrits dans votre signalement.',
      active: true,
      confidence: 0.5,
    });
  }

  return hypos;
}

/** Modèles mentaux dérivés des flux — pas d’étiquette métier. */
export function inferChainMentalModels(flows: JarvisFlowKind[]): string[] {
  const models: string[] = [];
  if (flows.includes('eau')) {
    models.push('Exutoire (3 verres) — amont / logement / aval');
  }
  if (flows.includes('signal')) {
    models.push('Chaîne signal — amont → liaison logement → poste local');
  }
  if (flows.includes('air')) {
    models.push('Enveloppe ↔ logement — air, humidité, VMC');
  }
  if (flows.includes('étanchéité')) {
    models.push('Enveloppe percée — toiture / façade → intérieur');
  }
  if (flows.includes('mécanique')) {
    models.push('Mécanique — élément, fixations, usure locale');
  }
  return models;
}

function topActiveHypotheses(sim: JarvisSimulationState, n = 2): PhysicalHypothesis[] {
  return [...sim.hypotheses]
    .filter((h) => h.active)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, n);
}

/** Prochaine question = comparaison entre les deux hypothèses les plus probables. */
export function pickChainQuestion(
  sim: JarvisSimulationState,
  lang: CompanionLanguage,
): string | null {
  if (sim.intakeComplete) return null;
  if (sim.resolvedSteps.includes('service_meter_link')) return null;
  if (
    sim.tenantFacts?.commonsSalubrityLead &&
    sim.tenantFacts.perimeterResolved
  ) {
    return null;
  }
  if (sim.hypotheses.some((h) => h.id === 'generic_observe' && h.active)) {
    return null;
  }

  if (!sim.resolvedSteps.includes('chain_compare')) {
    const [a, b] = topActiveHypotheses(sim, 2);
    if (a && b) {
      return jarvisChainCompareQuestion(a.label, b.label, lang);
    }
  }

  if (!sim.resolvedSteps.includes('chain_scope')) {
    return jarvisChainScopeQuestion(lang);
  }

  return null;
}

function boostHypothesis(
  hypotheses: PhysicalHypothesis[],
  idPrefix: string,
  delta: number,
): PhysicalHypothesis[] {
  return hypotheses.map((h) =>
    h.id.startsWith(idPrefix) || h.id.includes(idPrefix)
      ? { ...h, confidence: Math.min(h.confidence + delta, 0.95) }
      : h,
  );
}

function deactivateHypothesis(
  hypotheses: PhysicalHypothesis[],
  idPart: string,
): PhysicalHypothesis[] {
  return hypotheses.map((h) =>
    h.id.includes(idPart) ? { ...h, active: false, confidence: 0 } : h,
  );
}

/** Met à jour confiances / étapes à partir du message — même logique pour tout flux. */
export function applyChainDiscrimination(
  sim: JarvisSimulationState,
  message: string,
  opts?: { housingKind?: HousingKind; title?: string; description?: string },
): JarvisSimulationState {
  const msg = norm(message);
  let resolved = [...sim.resolvedSteps];
  let hypotheses = sim.hypotheses.map((h) => ({ ...h }));
  let intakeComplete = sim.intakeComplete;

  if (sim.domain !== 'generic') {
    return sim;
  }

  // Réponse au sondage collectif (voisins / parties communes) — TV signal
  if (
    /voisin|vwazen|escalier|parties communes|eclairage|éclairage|hall|couloir|commune|palier|ampoule|lumiere|lumière/.test(
      msg,
    )
  ) {
    if (!resolved.includes('savoir_collective')) resolved.push('savoir_collective');
  }

  if (
    /escalier|parties communes|hall|couloir|commune|palier/.test(msg) &&
    /eclairage|éclairage|lumiere|lumière|souci|panne|marche pas|ne s.?allume|coupe|allume pas/.test(
      msg,
    )
  ) {
    hypotheses = boostHypothesis(hypotheses, '_amont', 0.35);
    hypotheses = deactivateHypothesis(hypotheses, '_local');
    if (!resolved.includes('chain_compare')) resolved.push('chain_compare');
  }

  if (opts?.housingKind && message.trim()) {
    const effects = applyClinicalLinkEffects({
      title: opts.title ?? '',
      description: opts.description ?? '',
      message,
      housingKind: opts.housingKind,
      activeFlows: sim.activeFlows,
      resolvedSteps: resolved,
      hypotheses,
    });
    resolved = effects.resolvedSteps;
    hypotheses = effects.hypotheses;
    if (effects.intakeComplete) intakeComplete = true;
  }

  if (
    /toutes|partout|tout le logement|toute la maison|plusieurs tv|plusieurs prises/.test(
      msg,
    )
  ) {
    if (!resolved.includes('chain_scope')) resolved.push('chain_scope');
    hypotheses = deactivateHypothesis(hypotheses, '_local');
    hypotheses = boostHypothesis(hypotheses, '_amont', 0.2);
  }

  if (/seulement|une seule|juste une|cette tv|sur la tv|une tv/.test(msg)) {
    if (!resolved.includes('chain_scope')) resolved.push('chain_scope');
    hypotheses = boostHypothesis(hypotheses, '_local', 0.25);
  }

  if (/box|decodeur|d[eé]codeur|internet|wifi|hdmi|operateur|fournisseur/.test(msg)) {
    hypotheses = boostHypothesis(hypotheses, '_amont', 0.2);
    hypotheses = deactivateHypothesis(hypotheses, '_local');
    if (!resolved.includes('chain_compare')) resolved.push('chain_compare');
  }

  if (/tnt|antenne|parabole|sans internet/.test(msg)) {
    hypotheses = boostHypothesis(hypotheses, '_amont', 0.15);
    if (!resolved.includes('chain_compare')) resolved.push('chain_compare');
  }

  if (/cable|prise|hdmi|fil|branch/.test(msg)) {
    hypotheses = boostHypothesis(hypotheses, '_liaison', 0.2);
    if (!resolved.includes('chain_compare')) resolved.push('chain_compare');
  }

  const active = hypotheses.filter((h) => h.active);
  const top = active.sort((a, b) => b.confidence - a.confidence)[0];
  const second = active.sort((a, b) => b.confidence - a.confidence)[1];
  if (
    resolved.includes('chain_scope') &&
    (resolved.includes('chain_compare') || (top && top.confidence >= 0.55 && (!second || top.confidence - second.confidence >= 0.2)))
  ) {
    intakeComplete = true;
  }

  return {
    ...sim,
    hypotheses,
    resolvedSteps: resolved,
    intakeComplete,
    mentalModels: inferChainMentalModels(sim.activeFlows),
    visualizationSummary: buildChainVisualization(hypotheses.filter((h) => h.active), sim.scene),
  };
}

function buildChainVisualization(
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

/** Reconstruit flux + hypothèses quand le contexte enrichit le signalement. */
export function refreshGenericSimulation(
  sim: JarvisSimulationState,
  ctx: string,
): JarvisSimulationState {
  if (sim.domain !== 'generic') return sim;

  const flows = inferFlowsFromContext(ctx);
  const flowsChanged =
    flows.length !== sim.activeFlows.length ||
    flows.some((f) => !sim.activeFlows.includes(f));
  const onlyGenericObserve =
    sim.hypotheses.length === 1 && sim.hypotheses[0]?.id === 'generic_observe';

  if (!flowsChanged && !onlyGenericObserve) {
    return sim;
  }

  const scene = enrichGenericScene(sim.scene, ctx);
  const hypotheses = buildVisualChainHypotheses(flows, ctx, scene);

  return {
    ...sim,
    scene,
    activeFlows: flows,
    mentalModels: inferChainMentalModels(flows),
    hypotheses,
    resolvedSteps: onlyGenericObserve ? [] : sim.resolvedSteps,
    intakeComplete: onlyGenericObserve ? false : sim.intakeComplete,
    visualizationSummary: buildChainVisualization(
      hypotheses.filter((h) => h.active),
      scene,
    ),
  };
}

function inferFlowsFromContext(ctx: string): JarvisFlowKind[] {
  const flows = new Set<JarvisFlowKind>();
  if (/eau|fuit|coule|dlo|plomb|evier|lavabo/.test(ctx)) flows.add('eau');
  if (
    /\btv\b|television|tnt|antenne|decodeur|d[eé]codeur|box|chaine|signal|r[eé]ception/.test(
      ctx,
    )
  ) {
    flows.add('signal');
  }
  if (/humid|moisi|condens|vmc|odeur/.test(ctx)) flows.add('air');
  if (/toit|infiltr|facade|pluie/.test(ctx)) flows.add('étanchéité');
  if (/chauff|radiateur|clim|froid/.test(ctx)) flows.add('chaleur');
  if (/porte|gond|serrure|gache|frotte|coinc/.test(ctx)) flows.add('mécanique');
  if (flows.size === 0) flows.add('mécanique');
  return [...flows];
}

function enrichGenericScene(
  scene: JarvisScene3D,
  ctx: string,
): JarvisScene3D {
  let element = scene.element;
  let symptomAnchor = scene.symptomAnchor;

  if (/\btv\b|television|t[eé]l[eé]vision/.test(ctx)) {
    element = 'téléviseur';
    symptomAnchor = /aucun signal|pas de signal/.test(ctx)
      ? 'écran « aucun signal »'
      : 'réception / chaînes';
  }

  return { ...scene, element, symptomAnchor };
}
