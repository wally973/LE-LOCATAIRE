/**
 * Logique différentielle — signes cliniques (odeur, couleur, texture…) et scoring hypothèses.
 * S'appuie sur knowledge/pathology-index.json (fiches AQC / cours AFPOLS).
 */
import type {
  ClinicalSign,
  ClinicalSignChannel,
  DifferentialHypothesis,
  DiagnosticState,
  KnowledgeRef,
} from './lia-diagnostic-state.types';
import { emptyDiagnosticState } from './lia-diagnostic-state.types';
import {
  applySensorHypothesisAdjustments,
  extractDiagnosticSensors,
  formatDiagnosticSensorsBrief,
} from './lia-diagnostic-sensors';
import {
  getPathologyIndex,
  indexEntriesForCategory,
  type PathologyIndexEntry,
} from '../chercheur/research/knowledge-index.loader';

const ALL_CHANNELS: ClinicalSignChannel[] = [
  'color',
  'texture',
  'odor',
  'pattern',
  'location',
];

/** Normalise le texte pour matching signes / mots-clés. */
export function normalizeClinicalText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const TENANT_ODOR_HINTS: Array<{ re: RegExp; value: string }> = [
  { re: /odeur de moisi|sent le moisi|odeur de renferme|odeur humide/, value: 'odeur de moisi ou renfermé' },
  { re: /odeur de brule|sent le brule/, value: 'odeur de brûlé' },
];

const TENANT_COLOR_HINTS: Array<{ re: RegExp; value: string }> = [
  { re: /salpetre|salpêtre|depot blanc|poudre blanche/, value: 'salpêtre ou dépôt blanc' },
  { re: /frange|bande sombre|trace sombre/, value: 'franges ou bandes sombres' },
  { re: /moisissure noire|tache noire|points noirs/, value: 'moisissure noire' },
  { re: /auréole|aureole|tache brune/, value: 'auréole ou tache brune' },
];

const TENANT_TEXTURE_HINTS: Array<{ re: RegExp; value: string }> = [
  { re: /enduit qui se decolle|peinture qui cloque|cloque|decoll/, value: 'enduit ou peinture qui cloque' },
  { re: /mur humide|mur mouille|surface humide/, value: 'surface humide' },
  { re: /efflorescence|poudre sur/, value: 'efflorescence' },
];

const TENANT_PATTERN_HINTS: Array<{ re: RegExp; value: string }> = [
  { re: /quand il pleut|apres la pluie|pendant la pluie/, value: "s'aggrave avec la pluie" },
  { re: /depuis le sol|en partant du sol|plinthes/, value: 'monte depuis le sol / plinthes' },
  { re: /coin fenetre|angle froid|sous la fenetre/, value: 'coin ou angle froid' },
  {
    re: /19\s*h|20\s*h|21\s*h|entre\s+\d{1,2}\s*h|le soir|en soiree|uniquement le soir/,
    value: 'apparition à horaire précis (soir)',
  },
];

const TENANT_TEXTURE_SOAP: Array<{ re: RegExp; value: string }> = [
  {
    re: /savon|mousseux|mousseuse|mousse|savonnee|savonneuse/,
    value: 'eau savonneuse ou mousseuse',
  },
];

const TENANT_LOCATION_HINTS: Array<{ re: RegExp; value: string }> = [
  { re: /plafond|toiture|comble/, value: 'plafond / toiture' },
  { re: /salle de bain|sdb|douche/, value: 'salle de bain' },
  { re: /facade|exterieur|mur exterieur/, value: 'façade' },
  { re: /plinthes|rez-de-chaussee|rdc/, value: 'bas de mur / RDC' },
];

function extractFromHints(
  text: string,
  hints: Array<{ re: RegExp; value: string }>,
  channel: ClinicalSignChannel,
): ClinicalSign[] {
  const t = normalizeClinicalText(text);
  const out: ClinicalSign[] = [];
  for (const h of hints) {
    if (h.re.test(t)) {
      out.push({
        channel,
        value: h.value,
        source: 'tenant_text',
        confidence: 0.75,
      });
    }
  }
  return out;
}

/** Extrait les signes cliniques depuis le texte locataire / intake. */
export function extractClinicalSignsFromText(text: string): ClinicalSign[] {
  if (!text.trim()) return [];
  return [
    ...extractFromHints(text, TENANT_ODOR_HINTS, 'odor'),
    ...extractFromHints(text, TENANT_COLOR_HINTS, 'color'),
    ...extractFromHints(text, TENANT_TEXTURE_HINTS, 'texture'),
    ...extractFromHints(text, TENANT_TEXTURE_SOAP, 'texture'),
    ...extractFromHints(text, TENANT_PATTERN_HINTS, 'pattern'),
    ...extractFromHints(text, TENANT_LOCATION_HINTS, 'location'),
  ];
}

function signMatchesEntry(sign: ClinicalSign, entry: PathologyIndexEntry): boolean {
  const bucket = entry.clinicalSigns[sign.channel];
  if (!bucket?.length) return false;
  const v = normalizeClinicalText(sign.value);
  return bucket.some((hint) => {
    const h = normalizeClinicalText(hint);
    return v.includes(h) || h.split(/\s+/).some((w) => w.length > 4 && v.includes(w));
  });
}

function keywordScore(text: string, entry: PathologyIndexEntry): number {
  const t = normalizeClinicalText(text);
  let hits = 0;
  for (const kw of entry.keywords) {
    if (t.includes(normalizeClinicalText(kw))) hits += 1;
  }
  return entry.keywords.length ? hits / entry.keywords.length : 0;
}

function scoreEntry(
  entry: PathologyIndexEntry,
  signs: ClinicalSign[],
  contextText: string,
): number {
  let signScore = 0;
  let signMax = 0;
  for (const ch of ALL_CHANNELS) {
    const bucket = entry.clinicalSigns[ch];
    if (!bucket?.length) continue;
    signMax += 1;
    const channelSigns = signs.filter((s) => s.channel === ch);
    if (channelSigns.some((s) => signMatchesEntry(s, entry))) signScore += 1;
  }
  const signPart = signMax ? signScore / signMax : 0;
  const kwPart = keywordScore(contextText, entry);
  return signPart * 0.6 + kwPart * 0.4;
}

function entryToHypothesis(
  entry: PathologyIndexEntry,
  probability: number,
): DifferentialHypothesis {
  return {
    id: entry.id,
    label: entry.label,
    probability,
    category: entry.category,
    responsibilityHint: entry.responsibilityHint as DifferentialHypothesis['responsibilityHint'],
    danger: entry.danger as DifferentialHypothesis['danger'],
    sources: entry.sources.map(
      (s): KnowledgeRef => ({
        corpus: s.corpus as KnowledgeRef['corpus'],
        ref: s.ref,
        title: s.title,
        url: s.url,
      }),
    ),
  };
}

function collectResearchRefs(
  hypotheses: DifferentialHypothesis[],
): KnowledgeRef[] {
  const seen = new Set<string>();
  const refs: KnowledgeRef[] = [];
  for (const h of hypotheses.slice(0, 3)) {
    for (const s of h.sources) {
      const key = `${s.corpus}:${s.ref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(s);
    }
  }
  return refs;
}

function missingChannels(signs: ClinicalSign[]): ClinicalSignChannel[] {
  const present = new Set(signs.map((s) => s.channel));
  return ALL_CHANNELS.filter((c) => !present.has(c));
}

/** Score toutes les entrées pathology-index (AFPOL/AQC) pour un signalement. */
export function rankPathologyEntriesForContext(
  contextText: string,
  top = 4,
): Array<{ entry: PathologyIndexEntry; score: number }> {
  const signs = extractClinicalSignsFromText(contextText);
  let allEntries: PathologyIndexEntry[] = [];
  try {
    allEntries = getPathologyIndex().entries;
  } catch {
    return [];
  }

  return allEntries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, signs, contextText),
    }))
    .filter((x) => x.score > 0.06)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

/**
 * Construit ou met à jour le DiagnosticState (logique différentielle).
 */
export function buildDiagnosticState(params: {
  category: string;
  contextText: string;
  existing?: DiagnosticState | null;
  intakeAnswers?: Record<string, string>;
}): DiagnosticState {
  const base = params.existing ?? emptyDiagnosticState();
  const sensors = extractDiagnosticSensors({
    contextText: params.contextText,
    intakeAnswers: params.intakeAnswers,
  });
  const extracted = extractClinicalSignsFromText(params.contextText);
  const mergedSigns = [...base.clinicalSigns];
  for (const s of extracted) {
    const dup = mergedSigns.some(
      (m) => m.channel === s.channel && m.value === s.value,
    );
    if (!dup) mergedSigns.push(s);
  }

  const entries = indexEntriesForCategory(params.category);
  const scored = entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, mergedSigns, params.contextText),
    }))
    .filter((x) => x.score > 0.08)
    .sort((a, b) => b.score - a.score);

  const total = scored.reduce((s, x) => s + x.score, 0) || 1;
  let hypotheses: DifferentialHypothesis[] = scored.map(({ entry, score }) =>
    entryToHypothesis(entry, Math.round((score / total) * 1000) / 1000),
  );
  hypotheses = applySensorHypothesisAdjustments(hypotheses, sensors);

  const leading = hypotheses[0]?.id ?? null;
  const researchRefs = collectResearchRefs(hypotheses);

  return {
    clinicalSigns: mergedSigns,
    hypotheses,
    leadingHypothesisId: leading,
    researchRefs,
    sensors: Object.keys(sensors).length ? sensors : base.sensors,
    missingSignChannels: missingChannels(mergedSigns),
    differentialConfidence:
      hypotheses.length > 0 ? hypotheses[0].probability : 0,
    updatedAt: new Date().toISOString(),
  };
}

/** Résumé texte pour Lia Researcher (bibliothécaire). */
export function formatDiagnosticStateBrief(state: DiagnosticState): string {
  const lines: string[] = ['=== Logique différentielle ==='];
  if (state.sensors && Object.keys(state.sensors).length) {
    const brief = formatDiagnosticSensorsBrief(state.sensors);
    if (brief) lines.push(brief);
  }
  if (state.clinicalSigns.length) {
    lines.push(
      'Signes cliniques : ' +
        state.clinicalSigns
          .map((s) => `${s.channel}=${s.value}`)
          .join(' ; '),
    );
  }
  if (state.hypotheses.length) {
    lines.push('Hypothèses :');
    for (const h of state.hypotheses.slice(0, 4)) {
      lines.push(
        `  - ${h.label} (${Math.round(h.probability * 100)}%) → ${h.sources.map((s) => s.corpus + ' ' + s.ref).join(', ')}`,
      );
    }
  }
  if (state.researchRefs.length) {
    lines.push('Pages bibliothèque :');
    for (const r of state.researchRefs) {
      lines.push(`  - [${r.corpus} ${r.ref}] ${r.title}${r.url ? ' — ' + r.url : ''}`);
    }
  }
  if (state.missingSignChannels.length) {
    lines.push(
      'Signes manquants à demander : ' + state.missingSignChannels.join(', '),
    );
  }
  return lines.join('\n');
}
