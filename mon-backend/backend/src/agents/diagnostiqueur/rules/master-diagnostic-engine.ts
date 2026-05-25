/**
 * Moteur Savoir-Voir — arbres master-diagnostic-rules.json.
 */
import { getMasterDiagnosticRules } from '../../chercheur/knowledge/master-diagnostic-rules.loader';
import type {
  MasterDomainRules,
  MasterDifferentialResult,
  MasterHypothesisResult,
} from '../../chercheur/knowledge/master-diagnostic-rules.types';
import type { DiagnosticSensors } from '../../shared/lia-diagnostic-state.types';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Détecte le domaine master le plus pertinent. */
export function detectMasterDomain(text: string): MasterDomainRules | null {
  const t = norm(text);
  const catalog = getMasterDiagnosticRules();
  let best: MasterDomainRules | null = null;
  let bestScore = 0;
  for (const domain of catalog.domains) {
    let score = 0;
    for (const kw of domain.keywords) {
      if (t.includes(norm(kw))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  return bestScore > 0 ? best : null;
}

function inferSensorsFromText(
  domain: MasterDomainRules,
  text: string,
): Record<string, string> {
  const t = norm(text);
  const out: Record<string, string> = {};

  if (domain.id === 'ELECTRICITY') {
    if (/une (seule )?piece|localise|prise|interrupteur/.test(t)) {
      out.electric_scope = 'localisé (une pièce / une prise)';
    }
    if (/tout le logement|generale|coupure/.test(t)) {
      out.electric_scope = 'général (logement ou tableau)';
    }
    if (/grésill|gresill|brul|brûl|étincelle|etincelle/.test(t)) {
      out.danger_signs = 'grésillement / odeur de brûlé / étincelles';
    } else if (/pas de danger|sans odeur/.test(t)) {
      out.danger_signs = 'aucun signe de danger';
    }
    if (/disjonct|tableau/.test(t)) {
      out.breaker_behavior = 'mention tableau / disjoncteur';
    }
  }

  if (domain.id === 'CARPENTRY') {
    if (/porte/.test(t)) out.carpentry_element = 'porte';
    else if (/fenetre|fenêtre|baie/.test(t)) out.carpentry_element = 'fenêtre';
    else if (/volet/.test(t)) out.carpentry_element = 'volet';
    else if (/parquet|plinthe/.test(t)) out.carpentry_element = 'parquet / plinthe';
    if (/grince|ferme mal|casse|affaisse/.test(t)) {
      out.carpentry_symptom = 'fonctionnement dégradé ou cassure';
    }
    if (/humid|moisi|gonfle|infiltr/.test(t)) {
      out.humidity_link = 'oui';
    }
  }

  if (domain.id === 'VMC') {
    if (/cuisine/.test(t)) out.vmc_room = 'cuisine';
    else if (/sdb|salle de bain/.test(t)) out.vmc_room = 'SDB';
    if (/bruit|vromb/.test(t)) out.vmc_symptom = 'bruit anormal';
    else if (/plus d.?air|faible|ne tourne/.test(t)) {
      out.vmc_symptom = 'débit faible ou arrêt';
    }
  }

  if (domain.id === 'TERMITES') {
    if (/sciure|galeries|trou/.test(t)) {
      out.termite_evidence = 'traces ou galeries visibles';
    }
    if (/charpente|poutre|comble/.test(t)) out.wood_location = 'structure bois';
    else if (/plinthe|parquet|porte/.test(t)) {
      out.wood_location = 'menuiserie intérieure';
    }
  }

  if (domain.id === 'COMMON_AREAS') {
    if (/ascenseur|ascenceur/.test(t)) out.common_area_type = 'ascenseur';
    else if (/hall|entree/.test(t)) out.common_area_type = 'hall';
    else if (/cage d.?escalier/.test(t)) {
      out.common_area_type = 'cage d’escalier';
    }
    if (/bloque|coince|personne/.test(t)) {
      out.elevator_trapped = 'oui';
      out.collective_scope = 'sécurité personnes';
    } else {
      out.collective_scope = 'désordre collectif';
    }
  }

  return out;
}

export function mergeMasterSensors(
  domain: MasterDomainRules,
  text: string,
  base: DiagnosticSensors,
): DiagnosticSensors {
  const inferred = inferSensorsFromText(domain, text);
  return { ...base, ...inferred };
}

export function getMissingMasterCriticalSensors(
  domain: MasterDomainRules,
  sensors: DiagnosticSensors,
): string[] {
  const map = sensors as Record<string, string | undefined>;
  return domain.criticalSensors
    .filter((s) => s.required && !map[s.id]?.trim())
    .map((s) => s.id);
}

export function runMasterDifferential(params: {
  domain: MasterDomainRules;
  contextText: string;
  sensors?: DiagnosticSensors;
}): MasterDifferentialResult {
  const sensors = {
    ...inferSensorsFromText(params.domain, params.contextText),
    ...params.sensors,
  };
  const missingCriticalSensors = getMissingMasterCriticalSensors(
    params.domain,
    sensors,
  );

  const hypotheses: MasterHypothesisResult[] = params.domain.hypotheses.map(
    (h) => ({
      id: h.id,
      label: h.label,
      probability: h.defaultProbability,
      responsibilityHint: h.responsibilityHint,
    }),
  );

  const t = norm(params.contextText);
  for (const rule of params.domain.eliminationRules) {
    const re = new RegExp(rule.whenTextMatches, 'i');
    if (!re.test(t)) continue;
    for (const id of rule.eliminate) {
      const h = hypotheses.find((x) => x.id === id);
      if (h) {
        h.eliminated = true;
        h.probability = 0.04;
        h.eliminationReason = rule.eliminationReason;
      }
    }
    if (rule.boost) {
      for (const [id, prob] of Object.entries(rule.boost)) {
        const h = hypotheses.find((x) => x.id === id);
        if (h && !h.eliminated) h.probability = prob;
      }
    }
  }

  const active = hypotheses.filter((h) => !h.eliminated);
  const total = active.reduce((s, h) => s + h.probability, 0) || 1;
  for (const h of active) {
    h.probability = Math.round((h.probability / total) * 1000) / 1000;
  }
  active.sort((a, b) => b.probability - a.probability);
  const leading = active[0]!;

  let observation =
    `${params.domain.label} — hypothèse retenue : ${leading.label} (${Math.round(leading.probability * 100)} %).`;
  const eliminated = hypotheses.filter((h) => h.eliminated);
  if (eliminated.length) {
    observation +=
      ' Éliminations : ' +
      eliminated.map((h) => h.label).join(' ; ') +
      '.';
  }

  return {
    domainId: params.domain.id,
    domainLabel: params.domain.label,
    category: params.domain.category,
    leadingHypothesisId: leading.id,
    hypotheses,
    observation,
    responsibilityHint: leading.responsibilityHint,
    missingCriticalSensors,
  };
}

/** Urgence sécurité électricité / ascenseur. */
export function detectMasterUrgentDanger(
  contextText: string,
  domain?: MasterDomainRules | null,
): { urgent: boolean; domainId: string; message: string } {
  const t = norm(contextText);
  const catalog = getMasterDiagnosticRules();
  const domains = domain ? [domain] : catalog.domains;
  for (const d of domains) {
    for (const pattern of d.urgentDangerPatterns) {
      if (new RegExp(pattern, 'i').test(t)) {
        return {
          urgent: true,
          domainId: d.id,
          message:
            d.urgentSafetyMessage ??
            'Situation à risque — le bailleur est alerté en urgence. Mettez vous en sécurité.',
        };
      }
    }
  }
  return { urgent: false, domainId: '', message: '' };
}
