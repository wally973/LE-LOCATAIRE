/**
 * Fiches passives — data/panne-diagnostic-logique.json
 */
import * as fs from 'fs';
import * as path from 'path';
import type { PassiveSavoirCatalog, PassiveSavoirFiche } from './master-diagnostic-rules.types';

export function panneDiagnosticJsonPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'panne-diagnostic-logique.json'),
    path.join(process.cwd(), '..', '..', 'data', 'panne-diagnostic-logique.json'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'data', 'panne-diagnostic-logique.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Fichier data/panne-diagnostic-logique.json introuvable');
}

let cached: PassiveSavoirCatalog | null = null;

export function loadPanneDiagnosticFiches(): PassiveSavoirCatalog {
  if (cached) return cached;
  const raw = JSON.parse(
    fs.readFileSync(panneDiagnosticJsonPath(), 'utf8'),
  ) as PassiveSavoirCatalog & { panes?: PassiveSavoirFiche[] };
  if (!raw.fiches?.length && Array.isArray(raw.panes)) {
    raw.fiches = raw.panes.map((p) => ({
      ...p,
      lot: (p as { category?: string }).category ?? p.lot,
    }));
  }
  cached = raw;
  return raw;
}

export function fichesForLot(lot: string): PassiveSavoirFiche[] {
  const cat = lot.toUpperCase();
  return loadPanneDiagnosticFiches().fiches.filter(
    (f) => f.lot.toUpperCase() === cat,
  );
}
