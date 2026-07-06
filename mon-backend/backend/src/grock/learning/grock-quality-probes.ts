import {
  isDangerCommunicationIncoherent,
  isInferenceDecisionIncoherent,
} from '../kernel/grock-score-modulation';
import type { GrockConfidenceScores } from '../kernel/grock-confidence-scores';

/**
 * Étage 2 de la boucle d'apprentissage — SONDES DE QUALITÉ (offline).
 *
 * On analyse le journal de décision (étage 1) pour repérer, SANS l'IA et SANS
 * toucher au chemin locataire, les cas qui méritent l'arbitrage d'un humain
 * (étage 3). Chaque sonde est une fonction pure : entrée = lignes du journal,
 * sortie = candidats à leçon. Aucune règle de dialogue ici — uniquement de la
 * détection statistique d'incohérences.
 */

/** Une ligne du journal de décision (table grock_decision_journal). */
export interface GrockJournalRow {
  id: string;
  photoHash: string | null;
  title: string | null;
  description: string | null;
  tenantMessage: string | null;
  perception: string | null;
  state: string | null;
  responsibility: string | null;
  acknowledgment: string | null;
  noteInterne: string | null;
  model: string | null;
  visionModel: string | null;
  signalQuality: number | null;
  scores: string | null;
  interlocutor: string | null;
  preprocessedSignal: string | null;
  createdAt: Date;
}

export type ProbeKind =
  | 'variance_cadrage'
  | 'fuite'
  | 'degenerescence'
  | 'preuve_avant_conclusion'
  | 'score_incoherence'
  | 'signal_quality_faible';

export type ProbeSeverity = 'info' | 'warn' | 'high';

/** Un cas détecté, à soumettre à l'arbitrage humain (étage 3). */
export interface GrockLessonCandidate {
  kind: ProbeKind;
  severity: ProbeSeverity;
  photoHash?: string | null;
  rowIds: string[];
  summary: string;
  evidence: string[];
}

/** États qui concluent la responsabilité (par opposition aux états ouverts). */
const CONCLUSIVE_STATES = new Set([
  'bailleur_responsable',
  'locataire_responsable',
  'sinistre',
  'READY_TICKET',
]);

/**
 * Classe de responsabilité déduite de l'état Grock (miroir volontairement
 * simple de la logique ai-routing, pour comparer les tours entre eux).
 */
function responsibilityClass(state: string | null): string {
  switch (state) {
    case 'bailleur_responsable':
    case 'READY_TICKET':
      return 'BAILLEUR';
    case 'locataire_responsable':
      return 'LOCATAIRE';
    case 'sinistre':
      return 'ESCALADE_BAILLEUR';
    default:
      return 'OUVERT';
  }
}

/** Un accusé de réception dégénéré : vide, ou mot nu (< 3 mots sans question). */
function isDegenerate(ack: string | null): boolean {
  const t = (ack ?? '').trim();
  if (!t) return true;
  if (t.includes('?')) return false;
  return t.split(/\s+/).filter(Boolean).length < 3;
}

/**
 * Identifiants internes qui n'ont rien à faire dans la parole visible :
 * codes porteurs de chiffres (QV0373, B525…). Miroir du filet `stripInternalJargon`
 * pour détecter ce qui aurait échappé au masquage runtime.
 */
const INTERNAL_CODE_PATTERNS = [
  /\b[A-Z]{2,}\d[A-Z0-9]*\b/,
  /\b[A-Z]\d{2,}[A-Z0-9]*\b/,
];

function short(s: string | null | undefined, n = 140): string {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim().slice(0, n);
}

/**
 * Sonde A — VARIANCE AU CADRAGE.
 * Une même photo (photoHash) qui aboutit à des responsabilités différentes selon
 * le cadrage du locataire = signal fort : la décision se laisse teinter par le
 * récit au lieu de s'ancrer sur les faits.
 */
export function probeVarianceCadrage(
  rows: GrockJournalRow[],
): GrockLessonCandidate[] {
  const byHash = new Map<string, GrockJournalRow[]>();
  for (const r of rows) {
    if (!r.photoHash) continue;
    const list = byHash.get(r.photoHash) ?? [];
    list.push(r);
    byHash.set(r.photoHash, list);
  }

  const candidates: GrockLessonCandidate[] = [];
  for (const [hash, group] of byHash) {
    if (group.length < 2) continue;
    const classes = new Set(group.map((r) => responsibilityClass(r.state)));
    // On ignore le cas trivial où tout est « OUVERT » (aucune conclusion prise).
    const conclusive = [...classes].filter((c) => c !== 'OUVERT');
    if (classes.size < 2 || conclusive.length === 0) continue;

    candidates.push({
      kind: 'variance_cadrage',
      severity: conclusive.length >= 2 ? 'high' : 'warn',
      photoHash: hash,
      rowIds: group.map((r) => r.id),
      summary: `Même photo, décisions divergentes selon le cadrage : ${[...classes].join(
        ', ',
      )}.`,
      evidence: group.map(
        (r) =>
          `[${responsibilityClass(r.state)} · state=${r.state}] cadrage « ${short(
            r.title,
            40,
          )} / ${short(r.tenantMessage, 60)} »`,
      ),
    });
  }
  return candidates;
}

/**
 * Sonde B — FUITE.
 * Un identifiant interne (code porteur de chiffres) présent dans la parole
 * visible = fuite de confidentialité passée sous le filet de masquage.
 */
export function probeFuite(rows: GrockJournalRow[]): GrockLessonCandidate[] {
  const candidates: GrockLessonCandidate[] = [];
  for (const r of rows) {
    const ack = r.acknowledgment ?? '';
    const hit = INTERNAL_CODE_PATTERNS.map((re) => ack.match(re)?.[0]).find(
      Boolean,
    );
    if (!hit) continue;
    candidates.push({
      kind: 'fuite',
      severity: 'high',
      photoHash: r.photoHash,
      rowIds: [r.id],
      summary: `Identifiant interne « ${hit} » présent dans la parole visible au locataire.`,
      evidence: [short(ack, 200)],
    });
  }
  return candidates;
}

/**
 * Sonde C — DÉGÉNÉRESCENCE.
 * Un accusé de réception réduit à un mot nu n'est jamais une parole affichable.
 */
export function probeDegenerescence(
  rows: GrockJournalRow[],
): GrockLessonCandidate[] {
  const candidates: GrockLessonCandidate[] = [];
  for (const r of rows) {
    if (!isDegenerate(r.acknowledgment)) continue;
    candidates.push({
      kind: 'degenerescence',
      severity: 'warn',
      photoHash: r.photoHash,
      rowIds: [r.id],
      summary: 'Parole dégénérée (vide ou mot nu) affichée au locataire.',
      evidence: [`state=${r.state} · ack=« ${short(r.acknowledgment, 80)} »`],
    });
  }
  return candidates;
}

/**
 * Sonde D — PREUVE AVANT CONCLUSION.
 * Conclure une responsabilité sans aucune preuve visuelle (ni photo ce tour, ni
 * perception) contrevient à l'invariant « preuve avant conclusion ».
 */
export function probePreuveAvantConclusion(
  rows: GrockJournalRow[],
): GrockLessonCandidate[] {
  const candidates: GrockLessonCandidate[] = [];
  for (const r of rows) {
    if (!r.state || !CONCLUSIVE_STATES.has(r.state)) continue;
    const hasProof = Boolean(r.photoHash) || Boolean(r.perception?.trim());
    if (hasProof) continue;
    candidates.push({
      kind: 'preuve_avant_conclusion',
      severity: 'warn',
      photoHash: r.photoHash,
      rowIds: [r.id],
      summary: `Conclusion « ${r.state} » prise sans preuve visuelle (ni photo ni perception).`,
      evidence: [
        `cadrage « ${short(r.title, 40)} / ${short(r.tenantMessage, 60)} » → ${r.state}`,
      ],
    });
  }
  return candidates;
}

function parseJournalScores(raw: string | null): GrockConfidenceScores {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as GrockConfidenceScores;
  } catch {
    return {};
  }
}

/**
 * Sonde E — INCOHÉRENCE SCORES (danger ↔ parole, inference ↔ décision).
 */
export function probeScoreIncoherence(
  rows: GrockJournalRow[],
): GrockLessonCandidate[] {
  const candidates: GrockLessonCandidate[] = [];
  for (const r of rows) {
    const scores = parseJournalScores(r.scores);
    const dangerSpeech = isDangerCommunicationIncoherent(scores);
    const inferenceDecision = isInferenceDecisionIncoherent(scores, r.state);
    if (!dangerSpeech && !inferenceDecision) continue;

    const parts: string[] = [];
    if (dangerSpeech) {
      parts.push(
        `dangerLevel=${scores.dangerLevel} vs communicationIntensity=${scores.communicationIntensity}`,
      );
    }
    if (inferenceDecision) {
      parts.push(
        `inferenceConfidence=${scores.inferenceConfidence} + state=${r.state}`,
      );
    }

    candidates.push({
      kind: 'score_incoherence',
      severity: inferenceDecision ? 'high' : 'warn',
      photoHash: r.photoHash,
      rowIds: [r.id],
      summary: `Incohérence scores : ${parts.join(' ; ')}.`,
      evidence: [short(r.acknowledgment, 200)],
    });
  }
  return candidates;
}

/**
 * Sonde F — SIGNAL QUALITY FAIBLE → cas doctrine / demander photo.
 */
export function probeSignalQualityFaible(
  rows: GrockJournalRow[],
): GrockLessonCandidate[] {
  const candidates: GrockLessonCandidate[] = [];
  for (const r of rows) {
    const sq = r.signalQuality;
    if (sq == null || sq >= 4) continue;
    if (r.state === 'NEED_PHOTO' || r.acknowledgment?.toLowerCase().includes('photo')) {
      continue;
    }
    candidates.push({
      kind: 'signal_quality_faible',
      severity: 'warn',
      photoHash: r.photoHash,
      rowIds: [r.id],
      summary: `signalQuality=${sq} — cas doctrine : demander photo / preuve avant conclusion.`,
      evidence: [
        `state=${r.state} · inference=${parseJournalScores(r.scores).inferenceConfidence ?? '?'} · cadrage « ${short(r.title, 40)} / ${short(r.tenantMessage, 60)} »`,
      ],
    });
  }
  return candidates;
}

/** Lance toutes les sondes et agrège les candidats (tri par sévérité). */
export function runQualityProbes(
  rows: GrockJournalRow[],
): GrockLessonCandidate[] {
  const all = [
    ...probeVarianceCadrage(rows),
    ...probeFuite(rows),
    ...probeDegenerescence(rows),
    ...probePreuveAvantConclusion(rows),
    ...probeScoreIncoherence(rows),
    ...probeSignalQualityFaible(rows),
  ];
  const rank: Record<ProbeSeverity, number> = { high: 0, warn: 1, info: 2 };
  return all.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
