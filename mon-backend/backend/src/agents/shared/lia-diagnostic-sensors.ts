/**
 * Capteurs structurés pour le diagnostic différentiel (Golden REF_EAU_SAVONNEUSE).
 * Alimentés par le texte locataire + réponses intake (organisateur).
 */
import type {
  DiagnosticSensors,
  DifferentialHypothesis,
} from './lia-diagnostic-state.types';
import { normalizeClinicalText } from './lia-diagnostic-state';

/** Signalement « eau au sol » (flaque, nappe, milieu du salon, etc.). */
export function isWaterOnFloorReport(
  title: string,
  description: string,
  answers?: Record<string, string>,
): boolean {
  const t = normalizeClinicalText(
    `${title} ${description} ${Object.values(answers ?? {}).join(' ')}`,
  );
  const water =
    /eau|humide|mouill|coule|fuite|flaque|mare|nappe|inond/.test(t);
  const floor =
    /au sol|par terre|plancher|milieu du salon|milieu de la piece|sol du salon|flaque/.test(
      t,
    );
  return water && floor;
}

function extractBuildingFloor(text: string): string | undefined {
  const t = normalizeClinicalText(text);
  if (/\br\+1\b|r\s*\+\s*1|1er\s+etage|premier\s+etage|etage\s+1\b/.test(t)) {
    return 'R+1';
  }
  if (/\b2e\s+etage|deuxieme\s+etage|r\+2\b/.test(t)) return 'R+2';
  if (/\brdc\b|rez[- ]de[- ]chaussee/.test(t)) return 'RDC';
  return undefined;
}

function extractWeatherContext(text: string): string | undefined {
  const t = normalizeClinicalText(text);
  if (
    /saison seche|aucune pluie|pas de pluie|sans pluie|secheresse|sec depuis/.test(
      t,
    )
  ) {
    return 'Saison sèche';
  }
  if (/\bil pleut\b|pluie|pluvieux|cyclone|intemperie/.test(t)) {
    return 'Pluie / intempéries';
  }
  return undefined;
}

function extractWaterAspect(text: string): string | undefined {
  const t = normalizeClinicalText(text);
  if (/savon|mousseux|mousseuse|mousse|savonnee|savonneuse/.test(t)) {
    return 'savonneuse/mousseuse';
  }
  if (/trouble|laiteux|opaque/.test(t)) return 'trouble';
  if (/claire|transparente|cristalline/.test(t)) return 'claire';
  return undefined;
}

function extractSymptomAnchor(text: string): string | undefined {
  const t = normalizeClinicalText(text);
  const anchors: Array<[RegExp, string]> = [
    [/plafond|faux plafond/, 'plafond'],
    [/mur|cloison|paroi/, 'mur'],
    [/angle|coin/, 'angle'],
    [/sol|au sol|par terre|plancher|carrelage|flaque|nappe|milieu de la piece|milieu du salon/, 'sol'],
    [/derriere|derrière/, 'derrière un équipement ou un meuble'],
    [/sous\s+(?:l'|le|la|un|une)?\s*(evier|lavabo|machine|wc|toilette|chauffe eau)/, 'sous équipement'],
    [/evier|lavabo|wc|toilette|machine a laver|chauffe eau/, 'équipement sanitaire'],
  ];
  for (const [pattern, label] of anchors) {
    if (pattern.test(t)) return label;
  }
  return undefined;
}

/** Ex. « 19h-21h », « entre 19 et 21 », « le soir vers 20h ». */
function extractTimingPattern(text: string): string | undefined {
  const t = normalizeClinicalText(text);
  const range = t.match(
    /(?:entre\s+)?(\d{1,2})\s*h?\s*(?:et|a|-)\s*(\d{1,2})\s*h?/,
  );
  if (range) {
    return `${range[1]}h-${range[2]}h`;
  }
  const only = t.match(
    /(?:vers|a|entre)\s*(\d{1,2})\s*h|(\d{1,2})\s*h\s*(?:-|a)\s*(\d{1,2})/,
  );
  if (only) {
    const a = only[1] ?? only[2];
    const b = only[3];
    if (a && b) return `${a}h-${b}h`;
    if (a) return `${a}h`;
  }
  if (/le soir|en soiree|soir uniquement|uniquement le soir/.test(t)) {
    return 'soir (horaire précis à confirmer)';
  }
  return undefined;
}

/**
 * Extrait les capteurs depuis le texte et les réponses intake (ids water_aspect, timing_pattern, …).
 */
export function extractDiagnosticSensors(params: {
  contextText: string;
  intakeAnswers?: Record<string, string>;
}): DiagnosticSensors {
  const merged = [
    params.contextText,
    ...Object.entries(params.intakeAnswers ?? {}).map(
      ([k, v]) => `${k}: ${v}`,
    ),
  ].join('\n');

  const sensors: DiagnosticSensors = {};

  const aspectAnswer = params.intakeAnswers?.water_aspect?.trim();
  if (aspectAnswer) {
    const a = normalizeClinicalText(aspectAnswer);
    if (/mousse|savon/.test(a)) sensors.water_aspect = 'savonneuse/mousseuse';
    else if (/trouble/.test(a)) sensors.water_aspect = 'trouble';
    else if (/clair/.test(a)) sensors.water_aspect = 'claire';
    else sensors.water_aspect = aspectAnswer.slice(0, 80);
  } else {
    sensors.water_aspect = extractWaterAspect(merged);
  }

  const timingAnswer = params.intakeAnswers?.timing_pattern?.trim();
  if (timingAnswer) {
    sensors.timing_pattern =
      extractTimingPattern(timingAnswer) ?? timingAnswer.slice(0, 80);
  } else {
    sensors.timing_pattern = extractTimingPattern(merged);
  }

  const floorAnswer = params.intakeAnswers?.building_floor?.trim();
  sensors.building_floor =
    floorAnswer || extractBuildingFloor(merged) || undefined;

  const weatherAnswer = params.intakeAnswers?.weather_context?.trim();
  sensors.weather_context =
    weatherAnswer || extractWeatherContext(merged) || undefined;

  const anchorAnswer = params.intakeAnswers?.symptom_anchor?.trim();
  sensors.symptom_anchor =
    anchorAnswer || extractSymptomAnchor(merged) || undefined;

  return Object.fromEntries(
    Object.entries(sensors).filter(([, v]) => v != null && String(v).length > 0),
  ) as DiagnosticSensors;
}

/** Ligne courte pour le brief bibliothécaire / pathologiste. */
/**
 * Ajuste les hypothèses quand les capteurs excluent les 4 causes classiques
 * (logique REF_EAU_SAVONNEUSE : eau savonneuse + créneau horaire + saison sèche).
 */
export function applySensorHypothesisAdjustments(
  hypotheses: DifferentialHypothesis[],
  sensors: DiagnosticSensors,
): DifferentialHypothesis[] {
  const soapy = /savon|mousse/.test(
    normalizeClinicalText(sensors.water_aspect ?? ''),
  );
  const timed = Boolean(sensors.timing_pattern?.trim());
  const dry = /sec/.test(normalizeClinicalText(sensors.weather_context ?? ''));

  if (!soapy || !timed) return hypotheses;

  const excludeIds = new Set([
    'hyp_remontee_capillaire',
    'hyp_condensation_usage',
    'hyp_infiltration_toiture',
  ]);

  const adjusted = hypotheses.map((h) => {
    if (excludeIds.has(h.id)) {
      return {
        ...h,
        probability: Math.min(h.probability, 0.05),
        eliminated: true,
        eliminationReason:
          'Incompatible : eau savonneuse à horaire fixe (pas capillarité, condensation ni pluie).',
      };
    }
    if (h.id === 'hyp_refoulement_eu') {
      return { ...h, probability: Math.max(h.probability, 0.72) };
    }
    return h;
  });

  if (dry) {
    for (const h of adjusted) {
      if (h.id === 'hyp_infiltration_toiture') {
        h.eliminated = true;
        h.eliminationReason =
          'Incompatible : saison sèche signalée (pas d’alimentation pluie).';
        h.probability = 0.02;
      }
    }
  }

  const total =
    adjusted.reduce((s, h) => s + (h.eliminated ? 0 : h.probability), 0) || 1;
  return adjusted
    .map((h) =>
      h.eliminated
        ? h
        : { ...h, probability: Math.round((h.probability / total) * 1000) / 1000 },
    )
    .sort((a, b) => b.probability - a.probability);
}

export function formatDiagnosticSensorsBrief(sensors: DiagnosticSensors): string {
  const parts: string[] = [];
  if (sensors.water_aspect) parts.push(`aspect eau=${sensors.water_aspect}`);
  if (sensors.timing_pattern) parts.push(`horaire=${sensors.timing_pattern}`);
  if (sensors.building_floor) parts.push(`étage=${sensors.building_floor}`);
  if (sensors.weather_context) {
    parts.push(`météo=${sensors.weather_context}`);
  }
  if (sensors.symptom_anchor) parts.push(`symptôme=${sensors.symptom_anchor}`);
  if (!parts.length) return '';
  return 'Capteurs diagnostic : ' + parts.join(' ; ');
}
