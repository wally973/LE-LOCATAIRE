import { detectMultipleClaims } from '../agents/chercheur/knowledge/lia-multi-claim';
import { getPanneTreeById } from '../agents/orchestrateur/intake/lia-intake-organizer';
import type { LiaIntakeState } from '../agents/orchestrateur/intake/lia-intake.service';

export interface LiaLabVisualization {
  mentalModels: string[];
  activeFlows: string[];
  detectedLot: string;
  urgencyMode: string | null;
  language: string;
  jarvisFacts: Record<string, string>;
  visualizationNote: string | null;
  kbPanneId: string | null;
  kbPanneLabel: string | null;
  kbCausesActive: string[];
  kbCausesEliminated: string[];
  afpolRefs: string[];
  intakePhase: string;
  handoffRecommended: boolean;
}

function norm(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function buildLabVisualization(params: {
  state: LiaIntakeState;
  title: string;
  description: string;
  lastMessage?: string;
}): LiaLabVisualization {
  const full = norm(`${params.title} ${params.description} ${params.lastMessage ?? ''}`);
  const mentalModels: string[] = [];
  const activeFlows: string[] = [];

  if (/fuite|eau|coule|refoul|evacu|lavabo|evier|plomb|wc|caniveau/.test(full)) {
    activeFlows.push('eau');
    mentalModels.push('Exutoire (3 verres : amont → logement → aval)');
  }
  if (/condens|humid|moisi|vmc|ventil|odeur|air/.test(full)) {
    activeFlows.push('air');
    mentalModels.push('Dalle froide (R-1 froid → condensation R+1)');
  }
  if (/toit|toiture|infiltr|plafond|facade|goutti|enveloppe|terrasse/.test(full)) {
    activeFlows.push('étanchéité');
    mentalModels.push('Enveloppe percée (toiture → étages bas)');
  }
  if (/radiateur|chauff|clim|froid|chaleur/.test(full)) {
    activeFlows.push('chaleur');
  }
  if (/electri|disjoncteur|lumi|ampoule|courant/.test(full)) {
    activeFlows.push('électricité');
  }

  const claims = detectMultipleClaims(params.title, params.description);
  const lot = params.state.category ?? claims[0]?.label ?? 'GENERIC';

  let urgencyMode: string | null = null;
  if (
    (/bonjou|dlo|bokit|vit|anpil|koule/.test(full) || /urgent|press/.test(full)) &&
    /lavabo|evier|fuit|eau|dlo/.test(full)
  ) {
    urgencyMode = 'URGENCE_PLOMBERIE';
  }

  const lang =
    params.state.preferredLanguage === 'gcf' ? 'gcf' : 'fr';

  const tree = params.state.organizer?.panneId
    ? getPanneTreeById(params.state.organizer.panneId)
    : null;

  const eliminated = params.state.organizer?.eliminatedCauseIds ?? [];
  const activeCauses =
    tree?.causes
      .filter((c) => !eliminated.includes(c.id))
      .map((c) => c.label) ?? [];

  const afpolRefs = [
    'Référentiel AFPOLS / mémoire IA (simulation labo)',
    ...(tree ? [`Arbre panne : ${tree.label}`] : []),
    'DTU / CCTP — consultés à la phase diagnostic (hors dialogue)',
  ];

  return {
    mentalModels: [...new Set(mentalModels)],
    activeFlows: [...new Set(activeFlows)],
    detectedLot: lot,
    urgencyMode,
    language: lang,
    jarvisFacts: params.state.jarvisFacts ?? {},
    visualizationNote: params.state.jarvisFacts?.visualization ?? null,
    kbPanneId: params.state.organizer?.panneId ?? null,
    kbPanneLabel: tree?.label ?? null,
    kbCausesActive: activeCauses.slice(0, 6),
    kbCausesEliminated: eliminated.slice(0, 8),
    afpolRefs,
    intakePhase: params.state.phase,
    handoffRecommended: params.state.answers.jarvis_handoff === 'oui',
  };
}
