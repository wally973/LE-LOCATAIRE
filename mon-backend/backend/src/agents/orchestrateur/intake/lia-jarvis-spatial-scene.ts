/**
 * Tour 0 spatial — faits locataire → scène 3D Jarvis (perspective, flux, hypothèses).
 * Sans scène, le Savoir choisit des sondes hors-sujet (ex. marche sur hall sale).
 */
import type {
  JarvisFlowKind,
  JarvisScene3D,
  JarvisSimulationState,
  PhysicalHypothesis,
} from './lia-jarvis-simulation.engine';
import type { TenantSignalementFacts } from './lia-tenant-signalement-facts';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function inferFloorFromContext(ctx: string): string | null {
  if (/rdc|rez|plain.?pied|0 etage|0ème/.test(ctx)) return 'RDC';
  if (/r\+1|1er etage|premier etage/.test(ctx)) return 'R+1';
  if (/r\+2|2e etage|deuxieme etage/.test(ctx)) return 'R+2';
  if (/r\+6|dernier etage|toiture terrasse/.test(ctx)) return 'R+6';
  return null;
}

function buildCommonsSalubrityHypotheses(
  facts: TenantSignalementFacts,
  scene: JarvisScene3D,
): PhysicalHypothesis[] {
  const zones =
    facts.commonAreasMentioned.length > 0
      ? facts.commonAreasMentioned.join(' et ')
      : 'parties communes';
  return [
    {
      id: 'commons_salubrity',
      label: 'Salubrité parties communes — ménage bailleur',
      visualization: `Je visualise le ${zones} du bâtiment collectif — propreté insuffisante (saleté, odeurs, déchets). Zone à charge du bailleur : prestataire ménage des parties communes, pas réparation locative du lot privatif.`,
      active: true,
      confidence: 0.88,
    },
    {
      id: 'generic_observe',
      label: 'Observation terrain requise',
      visualization: 'Je visualise le logement et les flux décrits dans votre signalement.',
      active: false,
      confidence: 0,
    },
  ];
}

function applyCommonsSalubrityScene(
  scene: JarvisScene3D,
  facts: TenantSignalementFacts,
  ctx: string,
): JarvisScene3D {
  const primary =
    facts.commonAreasMentioned.find((a) => a === 'hall') ??
    facts.commonAreasMentioned[0] ??
    'parties communes';
  const floor = inferFloorFromContext(ctx) ?? scene.floorLevel;
  const zones =
    facts.commonAreasMentioned.length > 0
      ? facts.commonAreasMentioned.join(' + ')
      : 'parties communes';

  return {
    ...scene,
    floorLevel: floor,
    room: primary,
    element: 'salubrité / ménage',
    symptomAnchor: `propreté insuffisante — ${zones}`,
    above: facts.commonAreasMentioned.includes('escalier')
      ? 'logements desservis par la cage'
      : scene.above,
    below: facts.commonAreasMentioned.includes('hall') ? 'accès RDC / hall' : scene.below,
  };
}

function applyCommonsZoneScene(
  scene: JarvisScene3D,
  facts: TenantSignalementFacts,
  ctx: string,
): JarvisScene3D {
  const primary = facts.commonAreasMentioned[0] ?? 'parties communes';
  return {
    ...scene,
    floorLevel: inferFloorFromContext(ctx) ?? scene.floorLevel,
    room: primary,
    element: scene.element ?? `partie commune — ${primary}`,
    symptomAnchor: scene.symptomAnchor ?? facts.commonAreasMentioned.join(', '),
  };
}

function applyEquipmentAccessScene(
  scene: JarvisScene3D,
  subject: 'portail' | 'mailbox',
): JarvisScene3D {
  if (subject === 'portail') {
    return {
      ...scene,
      room: 'accès résidence / parking',
      element: 'portail motorisé',
      symptomAnchor: 'blocage ou moteur du portail',
    };
  }
  return {
    ...scene,
    room: 'hall / accès courrier',
    element: 'boîte aux lettres',
    symptomAnchor: 'mécanisme serrure / couvercle',
  };
}

function buildEuRefoulementHypotheses(scene: JarvisScene3D): PhysicalHypothesis[] {
  return [
    {
      id: 'eu_refoulement_column',
      label: 'Refoulement EU — colonne / descente bouchée',
      visualization:
        'Je visualise l’évier qui déborde : l’eau sale remonte par la descente d’eaux usées — bouchon probable dans la colonne de l’immeuble (exutoire aval bouché, pas fuite amont).',
      active: true,
      confidence: 0.94,
    },
    {
      id: 'generic_observe',
      label: 'Observation terrain requise',
      visualization: `Lieu : ${scene.room ?? 'cuisine'} — ${scene.element ?? 'évier → descente EU'}`,
      active: false,
      confidence: 0,
    },
  ];
}

function applyEuRefoulementScene(scene: JarvisScene3D, ctx: string): JarvisScene3D {
  const floor = inferFloorFromContext(ctx) ?? scene.floorLevel;
  return {
    ...scene,
    room: scene.room ?? 'cuisine',
    floorLevel: floor,
    element: 'évier → siphon → descente EU',
    symptomAnchor: 'évier plein — refoulement colonne EU',
    below: 'descente eaux usées / colonne immeuble',
    above: 'logements desservis au-dessus (réseau collectif)',
  };
}

function applySafetyUrgentDoorScene(scene: JarvisScene3D): JarvisScene3D {
  return {
    ...scene,
    room: scene.room ?? 'chambre',
    element: 'porte / serrure',
    symptomAnchor: 'porte bloquée — personne dans la pièce',
  };
}

function focusLockHypotheses(hypotheses: PhysicalHypothesis[]): PhysicalHypothesis[] {
  const lockTemplate: PhysicalHypothesis = {
    id: 'lock_misalign',
    label: 'Gâche ou serrure désalignée',
    visualization:
      'Je visualise la serrure qui accroche : le pêne et la gâche ne sont plus face à face.',
    active: true,
    confidence: 0.9,
  };
  const base = hypotheses.some((h) => h.id === 'lock_misalign')
    ? hypotheses
    : [...hypotheses, lockTemplate];

  return base.map((h) => ({
    ...h,
    active: h.id === 'lock_misalign',
    confidence: h.id === 'lock_misalign' ? 0.9 : 0,
  }));
}

function buildSpatialVisualizationSummary(
  hypos: PhysicalHypothesis[],
  scene: JarvisScene3D,
): string {
  const top = [...hypos]
    .filter((h) => h.active)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);
  const parts = top.map((h) => h.visualization);
  const place = [scene.room, scene.floorLevel].filter(Boolean).join(', ');
  if (place) {
    parts.unshift(`Lieu : ${place}${scene.element ? ` — ${scene.element}` : ''}`);
  } else if (scene.symptomAnchor) {
    parts.unshift(`Ancrage : ${scene.symptomAnchor}`);
  }
  return parts.join(' · ');
}

/** Met à jour scène 3D, flux et hypothèses depuis les faits locataire (obligatoire après extraction). */
export function applySpatialSceneFromTenantFacts(
  sim: JarvisSimulationState,
  facts: TenantSignalementFacts,
  ctx: string,
): JarvisSimulationState {
  let scene = { ...sim.scene };
  let activeFlows: JarvisFlowKind[] = [...sim.activeFlows];
  let mentalModels = [...sim.mentalModels];
  let hypotheses = sim.hypotheses.map((h) => ({ ...h }));

  if (facts.commonsSalubrityLead) {
    scene = applyCommonsSalubrityScene(scene, facts, ctx);
    activeFlows = ['air'];
    mentalModels = [
      'Parties communes — entretien bailleur (propreté, ménage)',
      'Perspective bâtiment collectif — pas réparation locative du seul lot',
    ];
    hypotheses = buildCommonsSalubrityHypotheses(facts, scene);
  } else if (facts.administrativeLead) {
    scene = {
      ...scene,
      element: 'accueil / administratif',
      symptomAnchor: 'demande hors intake technique',
    };
    activeFlows = [];
    mentalModels = [
      'Demande administrative — accueil / document (hors panne logement)',
    ];
    hypotheses = hypotheses.map((h) => ({ ...h, active: false, confidence: 0 }));
  } else if (facts.plumbingEuRefoulementLead && sim.domain === 'plumbing_sink') {
    scene = applyEuRefoulementScene(scene, ctx);
    activeFlows = ['eau'];
    mentalModels = [
      'Exutoire (3 verres) — verre 2 : évier plein, cuisine inondée',
      'Exutoire (3 verres) — verre 3 : colonne EU / descente bouchée (pas fuite amont)',
      'Réseau collectif — logements au-dessus possibles → refoulement EU',
    ];
    hypotheses = buildEuRefoulementHypotheses(scene);
  } else if (facts.plumbingBackupLead && sim.domain === 'plumbing_sink') {
    scene = {
      ...scene,
      room: scene.room ?? 'cuisine',
      element: scene.element ?? 'évier',
      symptomAnchor: 'évier plein — refoulement évacuation',
    };
    activeFlows = ['eau'];
    mentalModels = [
      'Refoulement évacuation — évier plein, eau sale, pièce inondée',
      'Exutoire (3 verres) — aval bouché, pas fuite amont',
    ];
    hypotheses = hypotheses.map((h) => ({
      ...h,
      active: h.id === 'drain_siphon',
      confidence: h.id === 'drain_siphon' ? 0.92 : 0,
    }));
  } else if (facts.plumbingUrgent && sim.domain === 'plumbing_sink') {
    scene = {
      ...scene,
      room: scene.room ?? 'cuisine',
      element: scene.element ?? 'évier',
      symptomAnchor: facts.plumbingFlooding
        ? 'inondation cuisine — évier / évacuation'
        : (scene.symptomAnchor ?? 'fuite urgente'),
    };
    activeFlows = ['eau'];
    mentalModels = [
      'Urgence plomberie — inondation ou évacuation bouchée',
      'Exutoire (3 verres) — amont / logement / aval sous l’évier',
    ];
    if (facts.plumbingFlooding) {
      hypotheses = hypotheses.map((h) =>
        h.id === 'drain_siphon'
          ? { ...h, active: true, confidence: Math.max(h.confidence, 0.75) }
          : h.id === 'supply_flexible'
            ? { ...h, active: true, confidence: h.confidence }
            : h,
      );
    }
  } else if (facts.safetyUrgent && sim.domain === 'carpentry_door') {
    scene = applySafetyUrgentDoorScene(scene);
    activeFlows = ['mécanique'];
    mentalModels = [
      'Urgence sécurité — personne enfermée (priorité serrurier)',
      'Mécanique — serrure / poignée (diagnostic ciblé, pas gonds pour l’instant)',
    ];
    hypotheses = focusLockHypotheses(hypotheses);
  } else if (
    facts.locationScope === 'communs' &&
    facts.commonAreasMentioned.length > 0 &&
    !facts.salubriteIssue &&
    !/\btv\b|television|tele|reception|signal|chaine|decodeur|d[eé]codeur|box|antenne/.test(ctx)
  ) {
    scene = applyCommonsZoneScene(scene, facts, ctx);
    if (
      !activeFlows.includes('signal') &&
      !activeFlows.includes('eau') &&
      /escalier|marche|porte/.test(ctx)
    ) {
      activeFlows = ['mécanique', ...activeFlows.filter((f) => f !== 'signal')];
    }
    mentalModels.push('Partie commune vs privatif — charge bailleur (entretien)');
  } else if (facts.equipmentSubject === 'portail' || facts.equipmentSubject === 'mailbox') {
    scene = applyEquipmentAccessScene(scene, facts.equipmentSubject);
    activeFlows = ['mécanique'];
    mentalModels.push('Accès résidence — mécanique / serrurerie légère');
  }

  const visualizationSummary = buildSpatialVisualizationSummary(
    hypotheses.filter((h) => h.active),
    scene,
  );

  return {
    ...sim,
    scene,
    activeFlows: [...new Set(activeFlows)],
    mentalModels: [...new Set(mentalModels)],
    hypotheses,
    visualizationSummary,
  };
}

/** Champs spatialisés pour jarvisFacts / console expert. */
export function spatialSceneToJarvisFacts(
  sim: JarvisSimulationState,
): Record<string, string> {
  const { scene } = sim;
  const out: Record<string, string> = {
    spatial_perimeter: sim.tenantFacts?.locationScope ?? 'unknown',
    spatial_flow: sim.activeFlows.join(', ') || '—',
  };
  if (scene.room) out.spatial_zone = scene.room;
  if (scene.floorLevel) out.spatial_floor = scene.floorLevel;
  if (scene.element) out.spatial_element = scene.element;
  if (scene.symptomAnchor) out.spatial_anchor = scene.symptomAnchor;
  if (sim.tenantFacts?.commonsSalubrityLead) {
    out.spatial_lead = 'salubrite_communs';
  }
  if (sim.tenantFacts?.safetyUrgent) {
    out.spatial_lead = 'urgence_securite';
  }
  if (sim.tenantFacts?.plumbingEuRefoulementLead) {
    out.spatial_lead = 'refoulement_eu_colonne';
  } else if (sim.tenantFacts?.plumbingUrgent) {
    out.spatial_lead = 'urgence_plomberie';
  }
  if (sim.tenantFacts?.administrativeLead) {
    out.spatial_lead = 'demande_administrative';
  }
  return out;
}
