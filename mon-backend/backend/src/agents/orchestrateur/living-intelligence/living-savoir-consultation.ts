/**
 * Éducation par les documents — index @knowledge + data/legal-references.
 * Les agents reçoivent une « perception » enrichie, sans citer les fiches comme des robots.
 */
import { loadLegalReferencesCatalogFromFile } from '../../../legal-references/legal-reference.loader';
import type { LegalReferenceEntryDto } from '../../../legal-references/legal-reference.types';
import {
  loadPathologyIndex,
  type PathologyIndex,
} from '../../chercheur/research/knowledge-index.loader';
import {
  extractClinicalSignsFromText,
  rankPathologyEntriesForContext,
} from '../../shared/lia-diagnostic-state';
import type { LivingSavoirConsultation } from './living-building-state.types';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function pathologyLabel(corpus: string, ref: string, title: string): string {
  return `${corpus} — ${ref} · ${title}`;
}

function legalLabel(entry: LegalReferenceEntryDto): string {
  const hint = entry.responsibilityHint ? ` (${entry.responsibilityHint})` : '';
  return `Décret / loi — ${entry.title}${hint}`;
}

/** Consultations AFPOL/AQC pour l’Enquêteur (fiches pathologies). */
export function consultEnqueteurSavoir(contextText: string): {
  consultations: LivingSavoirConsultation[];
  perceptionBrief: string;
} {
  let ranked: ReturnType<typeof rankPathologyEntriesForContext> = [];
  try {
    loadPathologyIndex();
    ranked = rankPathologyEntriesForContext(contextText, 4);
  } catch {
    return {
      consultations: [],
      perceptionBrief:
        'Bibliothèque pathologies indisponible — raisonner sur les flux physiques seuls.',
    };
  }

  const consultations: LivingSavoirConsultation[] = [];
  const seen = new Set<string>();
  const at = nowIso();

  for (const { entry, score } of ranked) {
    for (const src of entry.sources) {
      const key = `${src.corpus}:${src.ref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      consultations.push({
        agent: 'enqueteur',
        corpus: src.corpus as LivingSavoirConsultation['corpus'],
        ref: src.ref,
        title: src.title,
        url: src.url,
        label: pathologyLabel(src.corpus, src.ref, src.title),
        hypothesisId: entry.id,
        hypothesisLabel: entry.label,
        relevance: Math.round(score * 1000) / 1000,
        consultedAt: at,
      });
    }
  }

  const signs = extractClinicalSignsFromText(contextText);
  const signLine = signs.length
    ? `Signes repérés : ${signs.map((s) => `${s.channel}=${s.value}`).join(' ; ')}. `
    : '';

  const hypoLines = ranked.slice(0, 3).map((r) => {
    const pct = Math.round(r.score * 100);
    const hint = r.entry.responsibilityHint
      ? ` (charge probable ${r.entry.responsibilityHint})`
      : '';
    return `${r.entry.label}${hint} — piste ~${pct}%`;
  });

  const perceptionBrief = [
    'PERCEPTION MÉTIER (fiches pathologies AFPOL/AQC déjà lues — ne pas citer les codes en parole locataire) :',
    signLine,
    hypoLines.length
      ? `Pistes différentielles : ${hypoLines.join(' · ')}.`
      : 'Aucune fiche pathologie dominante — affiner activeFlows et hypothèses depuis le récit.',
    'Différencier infiltration / enveloppe / condensation avant de figer la vision 3D et le métier.',
  ]
    .filter(Boolean)
    .join('\n');

  return { consultations, perceptionBrief };
}

function scoreLegalEntry(entry: LegalReferenceEntryDto, text: string): number {
  const t = norm(text);
  let score = 0;
  for (const kw of entry.keywords) {
    if (t.includes(norm(kw))) score += 1;
  }
  if (entry.slug.includes('87-712') || entry.slug.includes('87-713')) score += 2;
  return score;
}

function consultAfpolCoursesForArchiviste(
  contextText: string,
  at: string,
): LivingSavoirConsultation[] {
  let index: PathologyIndex;
  try {
    index = loadPathologyIndex();
  } catch {
    return [];
  }
  const t = norm(contextText);
  const out: LivingSavoirConsultation[] = [];
  const courseMatchers: Array<{ code: string; re: RegExp }> = [
    { code: 'C0237', re: /eau|fuite|humid|moisi|infiltr|plomb|colonne|refoul/ },
    { code: 'C0233', re: /toiture|facade|façade|fissure|structure|enveloppe|etancheit|étanchéit/ },
    { code: 'C0236', re: /electri|vmc|ventil|chauffage|ascenseur/ },
    { code: 'C0411', re: /patholog|desordre|désordre|batiment|bâtiment/ },
  ];

  for (const m of courseMatchers) {
    if (!m.re.test(t)) continue;
    const course = index.courses?.find((c) => c.code === m.code);
    if (!course) continue;
    out.push({
      agent: 'archiviste',
      corpus: 'AFPOLS',
      ref: course.code,
      title: course.title,
      url: course.url,
      label: `AFPOLS — ${course.code} · ${course.title}`,
      relevance: 0.8,
      consultedAt: at,
    });
  }
  return out;
}

/** Consultations juridiques pour l’Archiviste (87-712 obligatoire + thèmes liés). */
export function consultArchivisteSavoir(contextText: string): {
  consultations: LivingSavoirConsultation[];
  perceptionBrief: string;
} {
  const consultations: LivingSavoirConsultation[] = [];
  const at = nowIso();
  const seen = new Set<string>();

  const pushLegal = (entry: LegalReferenceEntryDto, relevance: number) => {
    if (seen.has(entry.slug)) return;
    seen.add(entry.slug);
    consultations.push({
      agent: 'archiviste',
      corpus: entry.kind === 'LOI' ? 'LOI' : 'DECRET',
      ref: entry.slug,
      title: entry.title,
      url: entry.sources[0]?.url,
      label: legalLabel(entry),
      relevance,
      consultedAt: at,
    });
  };

  try {
    const catalog = loadLegalReferencesCatalogFromFile();
    const mandatory = [
      'decret-87-712-reparations-locatives',
      'decret-87-713-charges-recuperables',
      'code-civil-1719-bailleur',
    ];
    for (const slug of mandatory) {
      const entry = catalog.entries.find((e) => e.slug === slug);
      if (entry) {
        pushLegal(
          entry,
          slug.includes('87-712') || slug.includes('87-713') ? 1 : 0.9,
        );
      }
    }

    for (const afpol of consultAfpolCoursesForArchiviste(contextText, at)) {
      if (!seen.has(`AFPOLS:${afpol.ref}`)) {
        seen.add(`AFPOLS:${afpol.ref}`);
        consultations.push(afpol);
      }
    }

    const ranked = catalog.entries
      .map((entry) => ({ entry, score: scoreLegalEntry(entry, contextText) }))
      .filter((x) => x.score > 0 && !mandatory.includes(x.entry.slug))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    for (const { entry, score } of ranked) {
      pushLegal(entry, Math.min(0.95, score / 5));
    }
  } catch {
    return {
      consultations: [],
      perceptionBrief:
        'Référentiel juridique indisponible — charge INDETERMINE jusqu’à clarification.',
    };
  }

  const decret = consultations.find((c) => c.ref.includes('87-712'));
  const nuance = consultations.find((c) => c.ref.includes('humidite'));

  const decret713 = consultations.find((c) => c.ref.includes('87-713'));

  const perceptionBrief = [
    'PERCEPTION JURIDIQUE — TRI TRIPLE FLUX (87-712, 87-713, 1719 + cas AFPOLS déjà lus — ne pas citer les décrets à Marie) :',
    '• LOCATIF (87-712) : Marie paie et fait faire — ex. joint robinet, ampoule, clés perdues.',
    '• RÉCUPÉRABLE (87-713) : le bailleur envoie l’entreprise ; peut être intégré aux charges récupérables — ex. VMC collective, ascenseur, chauffage collectif.',
    '• PATRIMOINE (1719) : le bailleur paie — ex. colonne fuyarde, toiture, infiltration, structure.',
    decret
      ? '87-712 lu : liste des réparations locatives (menues réparations).'
      : '',
    decret713
      ? '87-713 lu : charges récupérables limitatives (équipements collectifs).'
      : '',
    nuance
      ? 'Humidité : surface/ventilation → LOCATIF possible ; infiltration toiture → PATRIMOINE.'
      : '',
    'chargeHorizon = LOCATIF | RECUPERABLE | PATRIMOINE uniquement.',
  ]
    .filter(Boolean)
    .join('\n');

  return { consultations, perceptionBrief };
}

/** Fusionne les consultations (dédupliquées) pour persistance LIVING_BUILDING_STATE. */
export function mergeSavoirConsultations(
  existing: LivingSavoirConsultation[],
  incoming: LivingSavoirConsultation[],
): LivingSavoirConsultation[] {
  const seen = new Set(
    existing.map((c) => `${c.agent}:${c.corpus}:${c.ref}`),
  );
  const out = [...existing];
  for (const c of incoming) {
    const key = `${c.agent}:${c.corpus}:${c.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(-32);
}

export function prepareLivingSavoirForDeliberation(params: {
  title: string;
  description: string;
  message: string;
  existingConsultations?: LivingSavoirConsultation[];
}): {
  enqueteurPerception: string;
  archivistePerception: string;
  savoirConsulted: LivingSavoirConsultation[];
} {
  const ctx = [params.title, params.description, params.message]
    .filter(Boolean)
    .join('\n');

  const enq = consultEnqueteurSavoir(ctx);
  const arch = consultArchivisteSavoir(ctx);

  return {
    enqueteurPerception: enq.perceptionBrief,
    archivistePerception: arch.perceptionBrief,
    savoirConsulted: mergeSavoirConsultations(
      params.existingConsultations ?? [],
      [...enq.consultations, ...arch.consultations],
    ),
  };
}
