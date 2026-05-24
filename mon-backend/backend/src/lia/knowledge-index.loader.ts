import * as fs from 'fs';
import * as path from 'path';

export interface PathologyIndexEntry {
  id: string;
  label: string;
  category: string;
  responsibilityHint?: string;
  danger?: string;
  sources: Array<{
    corpus: string;
    ref: string;
    title: string;
    url?: string;
  }>;
  clinicalSigns: Record<string, string[]>;
  keywords: string[];
}

export interface PathologyIndex {
  version: number;
  updatedAt: string;
  entries: PathologyIndexEntry[];
  courses: Array<{
    id: string;
    corpus: string;
    code: string;
    title: string;
    url?: string;
  }>;
}

export function pathologyIndexJsonPath(): string {
  const candidates = [
    path.join(process.cwd(), 'knowledge', 'pathology-index.json'),
    path.join(process.cwd(), '..', '..', 'knowledge', 'pathology-index.json'),
    path.resolve(__dirname, '..', '..', '..', '..', 'knowledge', 'pathology-index.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Fichier knowledge/pathology-index.json introuvable (cwd=' + process.cwd() + ')',
  );
}

let cached: PathologyIndex | null = null;

export function loadPathologyIndex(
  filePath = pathologyIndexJsonPath(),
): PathologyIndex {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PathologyIndex;
  cached = raw;
  return raw;
}

export function getPathologyIndex(): PathologyIndex {
  return cached ?? loadPathologyIndex();
}

/** Entrées index filtrées par catégorie Lia (HUMIDITY, PLUMBING, …). */
export function indexEntriesForCategory(category: string): PathologyIndexEntry[] {
  const idx = getPathologyIndex();
  const cat = category.toUpperCase();
  return idx.entries.filter((e) => e.category.toUpperCase() === cat);
}
