/**
 * Bibliothèque de Savoir brute — doctrine → Guyane → pathologies → loi.
 * Nourrit la délibération ; ne dicte pas le dialogue locataire.
 */
import { loadLegalReferencesCatalogFromFile } from '../../../legal-references/legal-reference.loader';
import { loadClimatTropicalCatalog } from '../../chercheur/knowledge/climat-tropical-catalog.loader';
import { loadPathologyIndex } from '../../chercheur/research/knowledge-index.loader';
import { listLedgerLessons } from './living-doctrine-ledger';
import type { LivingSavoirConsultation } from './living-building-state.types';

const MAX_LIBRARY_CHARS = 12_000;

export interface RawSavoirBibliotheque {
  prioriteTerritoriale: string;
  doctrine: Array<{
    id: string;
    author: string;
    title: string;
    body: string;
    createdAt: string;
    signedAt?: string | null;
  }>;
  reglementationTropicale: Array<{
    id: string;
    corpus: string;
    title: string;
    summary: string;
    keywords: string[];
    territory: string[];
    localPdf: string;
    sourceUrl: string;
  }>;
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
}

function loadDoctrineEntries(limit = 48): RawSavoirBibliotheque['doctrine'] {
  return listLedgerLessons({ status: 'SIGNED', limit }).map((l) => ({
    id: l.id,
    author: l.author,
    title: l.title,
    body: l.body,
    createdAt: l.createdAt,
    signedAt: l.signedAt ?? null,
  }));
}

/** Charge la bibliothèque complète (texte documentaire — l’agent décide seul). */
export function loadRawSavoirBibliotheque(): RawSavoirBibliotheque {
  const prioriteTerritoriale =
    'Guyane / RTAA-DOM : en cas de contradiction avec une règle métropolitaine, le savoir climat tropical prime.';

  const doctrine = loadDoctrineEntries(48);

  const reglementationTropicale: RawSavoirBibliotheque['reglementationTropicale'] = [];
  try {
    const tropical = loadClimatTropicalCatalog().sources;
    tropical.sort((a, b) => {
      const score = (s: typeof a) =>
        (s.territory.some((t) => /guyane/i.test(t)) ? 4 : 0) +
        (/RTAA/i.test(s.corpus) ? 3 : 0);
      return score(b) - score(a);
    });
    for (const s of tropical) {
      reglementationTropicale.push({
        id: s.id,
        corpus: s.corpus,
        title: s.title,
        summary: s.summary,
        keywords: s.keywords,
        territory: s.territory,
        localPdf: s.localPdf,
        sourceUrl: s.sourceUrl,
      });
    }
  } catch {
    /* catalogue climat tropical absent */
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

  return trimBibliothequeSize({
    prioriteTerritoriale,
    doctrine,
    reglementationTropicale,
    pathologies,
    loisEtDecrets,
  });
}

function trimBibliothequeSize(lib: RawSavoirBibliotheque): RawSavoirBibliotheque {
  let serialized = JSON.stringify(lib);
  if (serialized.length <= MAX_LIBRARY_CHARS) return lib;

  const doctrine = [...lib.doctrine];
  const tropical = [...lib.reglementationTropicale];
  const path = [...lib.pathologies];
  const lois = [...lib.loisEtDecrets];

  while (
    serialized.length > MAX_LIBRARY_CHARS &&
    (path.length > 3 || lois.length > 3 || doctrine.length > 4 || tropical.length > 4)
  ) {
    if (lois.length > 3) lois.pop();
    else if (path.length > 3) path.pop();
    else if (doctrine.length > 4) doctrine.pop();
    else tropical.pop();
    serialized = JSON.stringify({
      prioriteTerritoriale: lib.prioriteTerritoriale,
      doctrine,
      reglementationTropicale: tropical,
      pathologies: path,
      loisEtDecrets: lois,
    });
  }
  return {
    prioriteTerritoriale: lib.prioriteTerritoriale,
    doctrine,
    reglementationTropicale: tropical,
    pathologies: path,
    loisEtDecrets: lois,
  };
}

/** Trace Lia-Lab uniquement — pas injectée comme brief interprété. */
export function traceSavoirConsultationsForLab(): LivingSavoirConsultation[] {
  const lib = loadRawSavoirBibliotheque();
  const at = new Date().toISOString();
  const out: LivingSavoirConsultation[] = [];

  for (const d of lib.doctrine.slice(0, 6)) {
    out.push({
      agent: 'archiviste',
      corpus: 'AFPOLS',
      ref: d.id,
      title: d.title,
      label: `Doctrine N7 — ${d.title}`,
      relevance: 1,
      consultedAt: at,
    });
  }

  for (const r of lib.reglementationTropicale.slice(0, 8)) {
    out.push({
      agent: r.corpus === 'RTAA-DOM' ? 'archiviste' : 'enqueteur',
      corpus: 'AQC',
      ref: r.id,
      title: r.title,
      url: r.sourceUrl,
      label: `${r.corpus} — ${r.title}`,
      relevance: 1,
      consultedAt: at,
    });
  }

  for (const p of lib.pathologies.slice(0, 6)) {
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

  for (const l of lib.loisEtDecrets.slice(0, 4)) {
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
