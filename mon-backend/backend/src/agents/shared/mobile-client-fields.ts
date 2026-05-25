/**
 * Champs JSON lus par l'app mobile Flutter (CompanionState + diagnostic).
 * Partagé entre le script E2E et les tests unitaires.
 */
export interface MobileTicketFields {
  language: string | null;
  severity: string | null;
  sensors: Record<string, string> | null;
  legal_basis: string | null;
  avatar_action: string | null;
  verdict_label: string | null;
}

type JsonMap = Record<string, unknown>;

/** Miroir de `CompanionState.fromTicketJson` + capteurs diagnostic. */
export function extractMobileFields(ticket: JsonMap): MobileTicketFields {
  const ai = ticket.aiLastDecision;
  const aiMap = ai && typeof ai === 'object' ? (ai as JsonMap) : null;
  const companion =
    aiMap?.companion && typeof aiMap.companion === 'object'
      ? (aiMap.companion as JsonMap)
      : null;
  const diagnostic =
    aiMap?.diagnostic && typeof aiMap.diagnostic === 'object'
      ? (aiMap.diagnostic as JsonMap)
      : null;
  const intake =
    aiMap?.intake && typeof aiMap.intake === 'object'
      ? (aiMap.intake as JsonMap)
      : null;
  const intakeAnswers =
    intake?.answers && typeof intake.answers === 'object'
      ? (intake.answers as JsonMap)
      : null;

  const sensorKeys = [
    'water_aspect',
    'timing_pattern',
    'building_floor',
    'weather_context',
  ] as const;

  const mergedSensors: Record<string, string> = {};
  for (const key of sensorKeys) {
    const fromDiag = diagnostic?.sensors;
    if (fromDiag && typeof fromDiag === 'object') {
      const v = (fromDiag as JsonMap)[key];
      if (typeof v === 'string' && v.trim()) mergedSensors[key] = v.trim();
    }
    if (!mergedSensors[key] && intakeAnswers) {
      const raw = intakeAnswers[key];
      if (typeof raw === 'string' && raw.trim()) {
        mergedSensors[key] = raw.trim();
      }
    }
  }

  const sensors =
    Object.keys(mergedSensors).length > 0 ? mergedSensors : null;

  return {
    language: typeof companion?.language === 'string' ? companion.language : null,
    severity:
      typeof ticket.aiSeverity === 'string'
        ? ticket.aiSeverity
        : typeof aiMap?.severity === 'string'
          ? aiMap.severity
          : null,
    sensors: sensors && Object.keys(sensors).length > 0 ? sensors : null,
    legal_basis: typeof aiMap?.legal_basis === 'string' ? aiMap.legal_basis : null,
    avatar_action:
      typeof companion?.avatar_action === 'string' ? companion.avatar_action : null,
    verdict_label:
      typeof aiMap?.verdictLabel === 'string' ? aiMap.verdictLabel : null,
  };
}

/** Vérifie présence et typage (string / Record<string,string>). */
export function assertMobileFieldTypes(
  label: string,
  fields: MobileTicketFields,
  opts?: { requireAll?: boolean },
): void {
  const errors: string[] = [];

  if (fields.language !== null && typeof fields.language !== 'string') {
    errors.push(`language doit être string (reçu ${typeof fields.language})`);
  }
  if (fields.severity !== null && typeof fields.severity !== 'string') {
    errors.push(`severity doit être string (reçu ${typeof fields.severity})`);
  }
  if (fields.legal_basis !== null && typeof fields.legal_basis !== 'string') {
    errors.push(`legal_basis doit être string (reçu ${typeof fields.legal_basis})`);
  }
  if (fields.avatar_action !== null && typeof fields.avatar_action !== 'string') {
    errors.push(`avatar_action doit être string (reçu ${typeof fields.avatar_action})`);
  }
  if (fields.sensors !== null) {
    if (typeof fields.sensors !== 'object' || Array.isArray(fields.sensors)) {
      errors.push('sensors doit être un objet');
    } else {
      for (const [k, v] of Object.entries(fields.sensors)) {
        if (typeof v !== 'string') {
          errors.push(`sensors.${k} doit être string (reçu ${typeof v})`);
        }
      }
    }
  }

  if (opts?.requireAll) {
    for (const key of [
      'language',
      'severity',
      'sensors',
      'legal_basis',
      'avatar_action',
    ] as const) {
      if (fields[key] == null || fields[key] === '') {
        errors.push(`${key} manquant au verdict final`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation mobile (${label}) :\n  - ${errors.join('\n  - ')}`);
  }
}
