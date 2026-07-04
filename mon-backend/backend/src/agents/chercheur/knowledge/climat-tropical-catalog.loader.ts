/**
 * Catalogue Savoir climat tropical / Guyane — knowledge/climat-tropical/catalog.json
 */
import * as fs from 'fs';
import * as path from 'path';

export interface ClimatTropicalSource {
  id: string;
  corpus: string;
  title: string;
  year: number;
  territory: string[];
  topics: string[];
  localPdf: string;
  /** Fiche markdown locale (prioritaire pour le résumé injecté). */
  localMd?: string;
  sourceUrl: string;
  summary: string;
  keywords: string[];
}

export interface ClimatTropicalCatalog {
  schema: string;
  version: number;
  updatedAt: string;
  sources: ClimatTropicalSource[];
}

function resolveCatalogPath(): string {
  const candidates = [
    path.join(process.cwd(), 'knowledge', 'climat-tropical', 'catalog.json'),
    path.join(process.cwd(), '..', '..', 'knowledge', 'climat-tropical', 'catalog.json'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'knowledge', 'climat-tropical', 'catalog.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function resolveCatalogDir(): string {
  return path.dirname(resolveCatalogPath());
}

function enrichSourceFromMarkdown(
  source: ClimatTropicalSource,
  catalogDir: string,
): ClimatTropicalSource {
  if (!source.localMd?.trim()) return source;
  const mdPath = path.join(catalogDir, source.localMd);
  if (!fs.existsSync(mdPath)) return source;
  try {
    const body = fs.readFileSync(mdPath, 'utf8').trim();
    if (!body) return source;
    return {
      ...source,
      summary: body.length > 4000 ? `${body.slice(0, 3997)}…` : body,
    };
  } catch {
    return source;
  }
}

export function loadClimatTropicalCatalog(): ClimatTropicalCatalog {
  const filePath = resolveCatalogPath();
  if (!fs.existsSync(filePath)) {
    return { schema: 'CLIMAT_TROPICAL_CATALOG', version: 1, updatedAt: '', sources: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ClimatTropicalCatalog;
    if (!Array.isArray(raw.sources)) return { ...raw, sources: [] };
    const catalogDir = resolveCatalogDir();
    return {
      ...raw,
      sources: raw.sources.map((s) => enrichSourceFromMarkdown(s, catalogDir)),
    };
  } catch {
    return { schema: 'CLIMAT_TROPICAL_CATALOG', version: 1, updatedAt: '', sources: [] };
  }
}
