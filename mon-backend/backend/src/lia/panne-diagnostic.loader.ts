import * as fs from 'fs';
import * as path from 'path';
import type { PanneDiagnosticCatalog, PanneDiagnosticTree } from './panne-diagnostic.types';

/** Chemin du catalogue logique des pannes (racine repo). */
export function panneDiagnosticJsonPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'panne-diagnostic-logique.json'),
    path.join(process.cwd(), '..', '..', 'data', 'panne-diagnostic-logique.json'),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'data',
      'panne-diagnostic-logique.json',
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Fichier data/panne-diagnostic-logique.json introuvable (cwd=' +
      process.cwd() +
      ')',
  );
}

let cached: PanneDiagnosticCatalog | null = null;

export function loadPanneDiagnosticCatalog(
  filePath = panneDiagnosticJsonPath(),
): PanneDiagnosticCatalog {
  if (cached && cached.updatedAt) {
    const stat = fs.statSync(filePath);
    // Recharger si le fichier a changé (dev).
    const mtime = stat.mtime.toISOString().slice(0, 10);
    if (mtime <= cached.updatedAt) return cached;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  cached = JSON.parse(raw) as PanneDiagnosticCatalog;
  return cached;
}

/** Détecte l’arbre de panne le plus probable à partir du texte locataire. */
export function detectPanneFromText(text: string): PanneDiagnosticTree | null {
  const catalog = loadPanneDiagnosticCatalog();
  const t = text.toLowerCase();
  let best: { tree: PanneDiagnosticTree; score: number } | null = null;

  for (const hint of catalog.panneDetectionHints) {
    let score = 0;
    for (const p of hint.patterns) {
      if (t.includes(p.toLowerCase())) score += 1;
    }
    if (score === 0) continue;
    const tree = catalog.panes.find((p) => p.id === hint.panneId);
    if (!tree) continue;
    if (!best || score > best.score) best = { tree, score };
  }

  return best?.tree ?? null;
}

/**
 * Prochaine cause à questionner (danger d’abord, puis probabilité Guyane).
 * Exclut les causeId déjà écartées par les réponses intake.
 */
function isCauseRelevantInContext(
  cause: PanneDiagnosticTree['causes'][0],
  contextText: string,
): boolean {
  if (cause.skipOtherQuestions) return true;
  const t = contextText.toLowerCase();
  if (cause.danger.level === 'CRITICAL' && cause.probabilityGuyane < 0.05) {
    return /pluie|eau|humide|infiltration|goutte|plafond|odeur|brul|brûl|etincelle/.test(
      t,
    );
  }
  return true;
}

export function nextOrganizerCause(
  tree: PanneDiagnosticTree,
  eliminatedCauseIds: string[] = [],
  contextText = '',
): PanneDiagnosticTree['causes'][0] | null {
  const dangerOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const remaining = tree.causes.filter(
    (c) =>
      !eliminatedCauseIds.includes(c.id) &&
      isCauseRelevantInContext(c, contextText),
  );
  if (remaining.length === 0) return null;

  const byPriority = tree.organizerPriority
    .map((id) => remaining.find((c) => c.id === id))
    .filter((c): c is PanneDiagnosticTree['causes'][0] => c != null);

  const sorted = [...byPriority].sort((a, b) => {
    const da = dangerOrder[a.danger.level] ?? 9;
    const db = dangerOrder[b.danger.level] ?? 9;
    if (da !== db) return da - db;
    return b.probabilityGuyane - a.probabilityGuyane;
  });

  return sorted[0] ?? remaining[0];
}

/** Réponse locataire écarte-t-elle cette cause ? */
export function answerEliminatesCause(
  answer: string,
  cause: PanneDiagnosticTree['causes'][0],
): boolean {
  const a = answer.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return cause.discriminantQuestion.eliminatesIf.some((token) =>
    a.includes(token.toLowerCase()),
  );
}
