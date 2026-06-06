/**
 * Bibliothèque de Savoir brute — AFPOL / AQC / Loi sans commentaire ni classement imposé.
 */
import { loadLegalReferencesCatalogFromFile } from '../../../legal-references/legal-reference.loader';
import { loadPathologyIndex } from '../../chercheur/research/knowledge-index.loader';
import { loadSignedDoctrineForDeliberation } from './living-doctrine-stylo';
import type { LivingSavoirConsultation } from './living-building-state.types';

const MAX_LIBRARY_CHARS = 12_000;

export interface RawSavoirBibliotheque {
  pathologies: Array<{
    id: string;
    label: string;
    keywords: string[];
    sources: Array<{ corpus: string; ref: string; title: string; url?: string }>;
  }>;
  loisEtDecrets: Array<{
    slug: string;
    title: string;
    kind: string;
    summary: string;
    keywords: string[];
  }>;
  doctrine: Array<{
    id: string;
    author: string;
    title: string;
    body: string;
    createdAt: string;
    signedAt?: string | null;
  }>;
}

/** Charge la bibliothèque complète (texte documentaire — l’agent décide seul). */
export function loadRawSavoirBibliotheque(): RawSavoirBibliotheque {
  const loisEtDecrets: RawSavoirBibliotheque['loisEtDecrets'] = [];
  try {
    const catalog = loadLegalReferencesCatalogFromFile();
    for (const entry of catalog.entries) {
      loisEtDecrets.push({
        slug: entry.slug,
        title: entry.title,
        kind: entry.kind,
        summary: entry.summary ?? '',
        keywords: entry.keywords ?? [],
      });
    }
  } catch {
    /* bibliothèque juridique absente */
  }

  const pathologies: RawSavoirBibliotheque['pathologies'] = [];
  try {
    const index = loadPathologyIndex();
    for (const h of index.entries ?? []) {
      pathologies.push({
        id: h.id,
        label: h.label,
        keywords: h.keywords ?? [],
        sources: (h.sources ?? []).map((s) => ({
          corpus: s.corpus,
          ref: s.ref,
          title: s.title,
          url: s.url,
        })),
      });
    }
  } catch {
    /* index pathologies absent */
  }

  return trimBibliothequeSize({
    pathologies,
    loisEtDecrets,
    doctrine: loadSignedDoctrineForDeliberation(48),
  });
}

function trimBibliothequeSize(lib: RawSavoirBibliotheque): RawSavoirBibliotheque {
  let serialized = JSON.stringify(lib);
  if (serialized.length <= MAX_LIBRARY_CHARS) return lib;

  const lois = [...lib.loisEtDecrets];
  const path = [...lib.pathologies];
  const doctrine = [...lib.doctrine];
  while (
    serialized.length > MAX_LIBRARY_CHARS &&
    (lois.length > 3 || path.length > 5 || doctrine.length > 2)
  ) {
    if (path.length > 5) path.pop();
    else if (lois.length > 3) lois.pop();
    else doctrine.pop();
    serialized = JSON.stringify({ pathologies: path, loisEtDecrets: lois, doctrine });
  }
  return { pathologies: path, loisEtDecrets: lois, doctrine };
}

/** Trace Lia-Lab uniquement — pas injectée comme brief interprété. */
export function traceSavoirConsultationsForLab(): LivingSavoirConsultation[] {
  const lib = loadRawSavoirBibliotheque();
  const at = new Date().toISOString();
  const out: LivingSavoirConsultation[] = [];

  for (const p of lib.pathologies.slice(0, 8)) {
    for (const s of p.sources.slice(0, 1)) {
      out.push({
        agent: 'enqueteur',
        corpus: s.corpus as LivingSavoirConsultation['corpus'],
        ref: s.ref,
        title: s.title,
        url: s.url,
        label: `${s.corpus} — ${s.ref} · ${s.title}`,
        hypothesisId: p.id,
        hypothesisLabel: p.label,
        relevance: 1,
        consultedAt: at,
      });
    }
  }

  for (const l of lib.loisEtDecrets.slice(0, 6)) {
    out.push({
      agent: 'archiviste',
      corpus: l.kind === 'LOI' ? 'LOI' : 'DECRET',
      ref: l.slug,
      title: l.title,
      label: `${l.kind} — ${l.title}`,
      relevance: 1,
      consultedAt: at,
    });
  }

  return out;
}

/** Prépare l’entrée Tabula Rasa — pas de perceptionBrief. */
export function prepareTabulaRasaSavoir(): {
  bibliothequeSavoir: RawSavoirBibliotheque;
  savoirConsulted: LivingSavoirConsultation[];
} {
  return {
    bibliothequeSavoir: loadRawSavoirBibliotheque(),
    savoirConsulted: traceSavoirConsultationsForLab(),
  };
}
