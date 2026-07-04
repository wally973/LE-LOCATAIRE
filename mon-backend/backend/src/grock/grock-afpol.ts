/**
 * Dump brut index AFPOL/AQC — aucun scoring, aucun filtre, aucune logique dialogue.
 */
import { getPathologyIndex } from '../agents/chercheur/research/knowledge-index.loader';
import type { GrockDomain } from './grock-domain';

function norm(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function shouldKeepCourseForDomain(course: { title?: string; modules?: string[] }, domain?: GrockDomain | GrockDomain[]): boolean {
  const domains = Array.isArray(domain) ? domain : domain ? [domain] : [];
  if (!domains.includes('CARPENTRY_LOCK')) return true;
  const text = norm([course.title ?? '', ...(course.modules ?? [])].join(' '));
  return !/eau|humid|infiltrat|condensation|toiture/.test(text);
}

function shouldKeepEntryForDomain(entry: { category?: string; lots?: string[]; label?: string; keywords?: string[] }, domain?: GrockDomain | GrockDomain[]): boolean {
  const domains = Array.isArray(domain) ? domain : domain ? [domain] : [];
  if (!domains.includes('CARPENTRY_LOCK')) return true;
  const text = norm([entry.category ?? '', entry.label ?? '', ...(entry.lots ?? []), ...(entry.keywords ?? [])].join(' '));
  return !/humid|infiltrat|toiture|condensation|fuite|eau|refoulement|salpetre/.test(text);
}

export function loadAfpolDocsBlock(domain?: GrockDomain | GrockDomain[]): string {
  try {
    const index = getPathologyIndex();
    const lines: string[] = ['=== Cours AFPOLS / AQC ==='];

    for (const c of index.courses ?? []) {
      if (!shouldKeepCourseForDomain(c, domain)) continue;
      lines.push(`- [${c.code}] ${c.title}${c.url ? ` — ${c.url}` : ''}`);
    }

    lines.push('', '=== Fiches pathologies ===');
    for (const e of index.entries ?? []) {
      if (!shouldKeepEntryForDomain(e, domain)) continue;
      lines.push(
        [
          `## ${e.label}`,
          `id: ${e.id} · catégorie: ${e.category}`,
          `mots-clés: ${(e.keywords ?? []).join(', ')}`,
          `signes cliniques: ${JSON.stringify(e.clinicalSigns ?? {})}`,
          `sources: ${(e.sources ?? [])
            .map((s) => `${s.corpus} ${s.ref} — ${s.title}${s.url ? ` (${s.url})` : ''}`)
            .join(' | ')}`,
        ].join('\n'),
      );
      lines.push('');
    }

    const domains = Array.isArray(domain) ? domain : domain ? [domain] : [];
    if (domains.includes('CARPENTRY_LOCK')) {
      lines.push(
        '',
        '=== Filtre métier Grock ===',
        'Dossier serrurerie/menuiserie : fiches eau/humidité/infiltration masquées sauf preuve explicite dans le texte ou la photo.',
      );
    }

    return lines.join('\n').trim() || '(index AFPOL vide)';
  } catch {
    return '(index AFPOL indisponible — knowledge/pathology-index.json)';
  }
}
