/**
 * Moteur Savoir-Voir — fiches passives master-diagnostic-rules.json.
 * Pas de séquence de questions : observation et sécurité uniquement.
 */
import { getMasterDiagnosticRules } from '../../chercheur/knowledge/master-diagnostic-rules.loader';
import type {
  MasterDomainRules,
  MasterDifferentialResult,
  MasterHypothesisResult,
  PassiveSavoirFiche,
} from '../../chercheur/knowledge/master-diagnostic-rules.types';
import { fichesFromCatalog } from '../../chercheur/knowledge/master-diagnostic-rules.types';
import type { DiagnosticSensors } from '../../shared/lia-diagnostic-state.types';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function asDomainRules(fiche: PassiveSavoirFiche): MasterDomainRules {
  return { ...fiche, category: fiche.lot };
}

/** Détecte le lot / domaine le plus pertinent. */
export function detectMasterDomain(text: string): MasterDomainRules | null {
  const t = norm(text);
  const fiches = fichesFromCatalog(getMasterDiagnosticRules());
  let best: PassiveSavoirFiche | null = null;
  let bestScore = 0;
  for (const fiche of fiches) {
    let score = 0;
    for (const kw of fiche.keywords) {
      if (t.includes(norm(kw))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = fiche;
    }
  }
  return bestScore > 0 && best ? asDomainRules(best) : null;
}

export function mergeMasterSensors(
  _domain: MasterDomainRules,
  _text: string,
  base: DiagnosticSensors,
): DiagnosticSensors {
  return base;
}

export function getMissingMasterCriticalSensors(
  _domain: MasterDomainRules,
  _sensors: DiagnosticSensors,
): string[] {
  return [];
}

/** Synthèse passive — pas d'élimination scriptée ni capteurs obligatoires. */
export function runMasterDifferential(params: {
  domain: MasterDomainRules;
  contextText: string;
  sensors?: DiagnosticSensors;
}): MasterDifferentialResult {
  const pistes = params.domain.pistesConnues ?? [];
  const hypotheses: MasterHypothesisResult[] = pistes.map((p, i) => ({
    id: `${params.domain.id}_piste_${i}`,
    label: p.label,
    probability: pistes.length ? Math.round((1 / pistes.length) * 1000) / 1000 : 0,
    responsibilityHint: (p.chargeHint as MasterHypothesisResult['responsibilityHint']) ?? 'NUANCE',
  }));

  const leading = hypotheses[0];
  const observation = leading
    ? `${params.domain.label} — piste documentaire : ${leading.label}.`
    : `${params.domain.label} — fiche passive sans piste pré-indexée.`;

  return {
    domainId: params.domain.id,
    domainLabel: params.domain.label,
    category: params.domain.lot ?? params.domain.category,
    leadingHypothesisId: leading?.id ?? '',
    hypotheses,
    observation,
    responsibilityHint: leading?.responsibilityHint ?? 'NUANCE',
    missingCriticalSensors: [],
  };
}

/** Urgence sécurité — seule logique dure conservée. */
export function detectMasterUrgentDanger(
  contextText: string,
  domain?: MasterDomainRules | null,
): { urgent: boolean; domainId: string; message: string } {
  const t = norm(contextText);
  const fiches = domain
    ? [domain]
    : fichesFromCatalog(getMasterDiagnosticRules()).map(asDomainRules);
  for (const d of fiches) {
    for (const pattern of d.signesUrgence ?? []) {
      if (new RegExp(pattern, 'i').test(t)) {
        return {
          urgent: true,
          domainId: d.id,
          message:
            d.messageSecurite ??
            'Situation à risque — le bailleur est alerté en urgence. Mettez vous en sécurité.',
        };
      }
    }
  }
  return { urgent: false, domainId: '', message: '' };
}
