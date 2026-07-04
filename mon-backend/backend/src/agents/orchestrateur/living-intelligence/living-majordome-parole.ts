/**
 * Normalisation parole Majordome — jamais de JSON brut dans le chat locataire.
 */

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  return '';
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  try {
    const p = JSON.parse(text) as unknown;
    return p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pickMessageField(obj: Record<string, unknown>): string {
  for (const key of [
    'tenantMessage',
    'message',
    'response',
    'parole',
    'text',
    'content',
    'insight',
  ]) {
    const v = asString(obj[key]);
    if (v && !v.startsWith('{')) return v;
  }
  return '';
}

/** Extrait la parole locataire depuis la réponse Groq (JSON ou texte). */
export function unwrapMajordomeParole(raw: string | null): string {
  if (!raw?.trim()) return '';

  const trimmed = raw.trim();
  const parsed = tryParseJsonObject(trimmed);
  if (parsed) {
    const msg = pickMessageField(parsed);
    if (msg) return msg;
  }

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return trimmed;
  }

  return '';
}

/** Rejette une chaîne qui ressemble encore à du JSON (fuite UI). */
export function isJsonLeak(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith('{')) return false;
  return /"message"|"tenantMessage"|"action"|awaiting_tenant/i.test(t);
}

/** Synthèse interne depuis un rapport expert JSON (même sans champ "insight"). */
export function extractExpertInsight(report: Record<string, unknown> | null | undefined): string | null {
  if (!report) return null;

  const direct = asString(report.insight);
  if (direct) return direct;

  const parts: string[] = [];

  const hypotheses = report.hypotheses;
  if (Array.isArray(hypotheses)) {
    for (const h of hypotheses.slice(0, 3)) {
      if (typeof h === 'string') {
        parts.push(h);
        continue;
      }
      if (h && typeof h === 'object') {
        const row = h as Record<string, unknown>;
        const label = asString(row.label);
        const viz = asString(row.visualization);
        if (label) parts.push(viz ? `${label} (${viz})` : label);
      }
    }
  }

  for (const key of ['visualLogicNotes', 'doubt', 'doctrineLesson', 'tenantFacingProbe']) {
    const v = asString(report[key]);
    if (v) parts.push(v);
  }

  const v3 = report.vision3d;
  if (v3 && typeof v3 === 'object') {
    const row = v3 as Record<string, unknown>;
    const anchor = asString(row.symptomAnchor);
    const element = asString(row.element);
    const flows = row.activeFlows;
    if (anchor) parts.push(`Signe : ${anchor}`);
    if (element) parts.push(`Élément : ${element}`);
    if (Array.isArray(flows) && flows.length) {
      parts.push(`Flux : ${flows.slice(0, 3).join(', ')}`);
    }
  }

  const legal = report.legalVerdict;
  if (legal && typeof legal === 'object') {
    const charge = asString((legal as Record<string, unknown>).tenantChargeExplanation);
    if (charge) parts.push(charge);
  }

  const merged = parts.filter(Boolean).join('. ').trim();
  return merged ? merged.slice(0, 500) : null;
}

function isTemporalAnswer(msg: string): boolean {
  return /\b(tout(?:e)?s?\s*(?:le\s*)?temps|par\s+(?:tout(?:e)?s?\s*(?:le\s*)?temps|beau\s+temps)|24\s*\/?\s*24|h24|permanent(?:e)?s?|constant(?:e)?s?|toute\s+l['']ann[eé]e|en\s+permanence|(?:apr[eè]s|quand\s+il)\s+(?:pleut|la\s+pluie)|(?:par\s+)?forte\s+chaleur|canicule|saison\s+(?:s[eè]che|humide)|(?:non|pas)\s+(?:seulement\s+)?(?:apr[eè]s\s+la\s+pluie|par\s+forte\s+chaleur))\b/i.test(
    msg,
  );
}

function isMetaFrustration(msg: string): boolean {
  return /\b(pourquoi\s+tu\s+(?:me\s+)?r[eé]p[eè]tes?|tu\s+(?:me\s+)?r[eé]p[eè]tes?|arr[eê]te|d[eé]j[aà]\s+(?:dit|demand[eé]|r[eé]pondu)|c['']est\s+pareil|encore\s+la\s+m[eê]me|(?:ne\s+)?(?:me\s+)?redemande\s+pas)\b/i.test(
    msg,
  );
}

function buildContextualProbe(params: {
  signalementTitle: string;
  signalementDescription: string;
  activeFlows: string[];
  temporalAnswered: boolean;
}): string {
  const context = [
    params.signalementTitle,
    params.signalementDescription,
    ...params.activeFlows,
  ]
    .join(' ')
    .toLowerCase();

  if (/moisi|humid|salp[eè]tre|mur\s+froid|infiltr|condensation|tache/.test(context)) {
    if (params.temporalAnswered) {
      return (
        'Si c’est permanent, une humidité de structure ou un pont thermique est fréquent en Guyane. ' +
        'Sentez-vous une odeur de moisi ou de renfermé près du mur concerné ?'
      );
    }
    return 'Est-ce que cela apparaît surtout après la pluie, par forte chaleur, ou en permanence ?';
  }

  if (/[eé]lectri|disjonct|arc|multiprise|prise/.test(context)) {
    return 'Le problème est-il constant ou seulement quand vous utilisez un appareil précis ?';
  }

  if (/fuite|eau|robinet|canalis/.test(context)) {
    return 'L’eau coule en permanence ou seulement à certaines heures ?';
  }

  if (params.temporalAnswered) {
    return 'Pouvez-vous me décrire l’étendue (surface touchée) et si une odeur ou une dégradation visible s’ajoute ?';
  }

  return 'Pouvez-vous me décrire ce que vous voyez exactement (taches, odeur, étendue) ?';
}

/** Parole de secours — synthèse des rapports experts si Groq speak échoue. */
export function buildDeliberationFallbackParole(params: {
  displayName: string;
  tenantMessage: string;
  mode: 'opening' | 'tenant_turn';
  signalementTitle: string;
  signalementDescription?: string;
  activeFlows?: string[];
  enqueteurInsight: string | null;
  archivisteInsight: string | null;
  constructiveDoubt: string | null;
  anchoringConfirmed?: boolean;
}): string {
  const name = params.displayName.trim() || 'Marie';
  const flows = params.activeFlows ?? [];
  const description = params.signalementDescription?.trim() ?? '';

  if (params.mode === 'opening') {
    const sujet = params.signalementTitle.trim() || 'votre signalement';
    return `${name}, bonjour — j’ai bien reçu votre demande concernant ${sujet.toLowerCase()}. Comment puis-je vous aider ?`;
  }

  const msg = params.tenantMessage.trim();
  const legalAsk = /norme|rtaa|loi|d[eé]cret|papier peint|juridique|charge|bailleur|danger/i.test(
    msg,
  );

  if (/upload|internet|pdf|trouve.*fichier|t[eé]l[eé]charge/i.test(msg)) {
    const tail = params.anchoringConfirmed === false
      ? 'Décrivez ce que vous observez sur place — je vérifie d’abord que nous parlons du même élément.'
      : 'En attendant, décrivez ce que vous observez (taches, odeur, froid du mur).';
    return (
      `${name}, dans le Lia-Lab je ne peux pas parcourir Internet ni importer de PDF moi-même — ` +
      'transmettez le document à l’Architecte pour l’ajouter au Savoir. ' +
      tail
    );
  }

  const enq = params.enqueteurInsight?.trim() ?? '';
  const arch = params.archivisteInsight?.trim() ?? '';
  let core = (legalAsk ? arch : enq) || enq || arch;

  if (core) {
    if (!core.toLowerCase().includes(name.toLowerCase())) {
      core = `${name}, ${core.charAt(0).toLowerCase()}${core.slice(1)}`;
    }
    return core.slice(0, 900);
  }

  const temporalAnswered = isTemporalAnswer(msg);
  const probe = buildContextualProbe({
    signalementTitle: params.signalementTitle,
    signalementDescription: description,
    activeFlows: flows,
    temporalAnswered,
  });

  if (isMetaFrustration(msg)) {
    const doubt = params.constructiveDoubt?.trim();
    return (
      `${name}, pardon si je me suis répété — je reprends calmement. ` +
      (doubt ? `${doubt} ` : '') +
      probe
    );
  }

  if (temporalAnswered) {
    const doubt = params.constructiveDoubt?.trim();
    return `${name}, merci — j’ai bien compris que c’est permanent. ${doubt ? `${doubt} ` : ''}${probe}`;
  }

  if (msg) {
    const doubt = params.constructiveDoubt?.trim();
    return `${name}, ${doubt ? `${doubt} ` : ''}${probe}`;
  }

  return `${name}, je suis avec vous — que voyez-vous exactement sur place ?`;
}
