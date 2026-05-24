/**
 * Charge data/installations-charges-vetuste.json — matrice charge / vétusté (Savoir).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface InstallationEntry {
  id: string;
  label: string;
  family: string;
  chargePendantBail: string;
  chargeSiVetuste?: string;
  chargeSiEncastre?: string;
  keywords?: string[];
  notes?: string;
}

interface InstallationsCatalog {
  installations: InstallationEntry[];
  principles?: { vetuste?: { regle?: string } };
}

let cached: InstallationsCatalog | null = null;

function resolveCatalogPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'installations-charges-vetuste.json'),
    path.join(
      process.cwd(),
      '..',
      '..',
      'data',
      'installations-charges-vetuste.json',
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'installations-charges-vetuste.json introuvable (cwd=' + process.cwd() + ')',
  );
}

export function loadInstallationsCatalog(): InstallationsCatalog {
  if (cached) return cached;
  const raw = fs.readFileSync(resolveCatalogPath(), 'utf8');
  cached = JSON.parse(raw) as InstallationsCatalog;
  return cached;
}

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Postes dont les mots-clés matchent la description locataire (ordre stable, max 5). */
export function matchInstallationsFromText(
  text: string,
  limit = 5,
): InstallationEntry[] {
  const catalog = loadInstallationsCatalog();
  const t = normalize(text);
  const scored: Array<{ entry: InstallationEntry; score: number }> = [];

  for (const entry of catalog.installations) {
    const kws = entry.keywords ?? [];
    if (kws.length === 0) continue;
    let score = 0;
    for (const kw of kws) {
      const n = normalize(kw);
      if (n.length >= 3 && t.includes(n)) score += 1;
    }
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: InstallationEntry[] = [];
  for (const { entry } of scored) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

/** Bloc court pour le brief recherche (pathologiste / juriste). */
export function formatInstallationsBrief(text: string): string {
  try {
    const matches = matchInstallationsFromText(text);
    if (matches.length === 0) return '';

    const lines = matches.map((m) => {
      const parts = [
        `${m.label} (${m.id})`,
        `charge courante: ${m.chargePendantBail}`,
      ];
      if (m.chargeSiEncastre === 'BAILLEUR') {
        parts.push('si encastré/inaccessible → BAILLEUR');
      }
      if (m.chargeSiVetuste === 'BAILLEUR') {
        parts.push('si vétusté → BAILLEUR');
      }
      if (m.notes) parts.push(m.notes);
      return '- ' + parts.join(' ; ');
    });

    const catalog = loadInstallationsCatalog();
    const vetusteRule =
      catalog.principles?.vetuste?.regle?.slice(0, 120) ??
      'Vétusté → bailleur même si réparation locative.';

    return (
      'Matrice installations (Savoir — indicatif) :\n' +
      lines.join('\n') +
      `\nRappel : ${vetusteRule}…`
    );
  } catch {
    return '';
  }
}
