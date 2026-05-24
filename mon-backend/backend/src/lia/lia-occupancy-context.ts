/**
 * Contexte d’occupation — remise en état, fenêtre 6 mois, GPA (1 an).
 * Comparaison systématique par rapport à l’entrée du locataire, pas seulement l’usage prolongé.
 */

/** Fenêtre pendant laquelle les menues réparations mal faites à la remise en état restent charge bailleur. */
export const POST_HANDOVER_REPAIR_WINDOW_MONTHS = 6;

/** Durée type GPA après livraison / remise en état neuve (dates réelles : `HlmResidence.gpaEndDate`). */
export const GPA_STANDARD_DURATION_MONTHS = 12;

export interface OccupancyContextSignals {
  mentionsRemiseEnEtat: boolean;
  /** Livraison neuve, remise en état récente, construction récente. */
  mentionsNewHandover: boolean;
  mentionsGpa: boolean;
  /** Mois depuis l’entrée si déductible du texte. */
  monthsSinceMoveIn: number | null;
  /** Entrée ou problème dans les 6 mois suivant l’emménagement. */
  withinSixMonthsOfMoveIn: boolean;
  problemSinceMoveIn: boolean;
  /** Menues réparations non correctement réalisées lors de la remise en état. */
  smallRepairsMissedAtHandover: boolean;
  /** Travaux entreprise sans électricité / douille posée sans test. */
  handoverWorkmanshipDefect: boolean;
}

export function normalizeOccupancyText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function parseMonthsSinceMoveIn(t: string): number | null {
  const m1 = t.match(/depuis\s+(\d+)\s+mois/);
  if (m1) return Number(m1[1]);
  if (/\bdepuis (1|un) mois\b/.test(t) || /\bca fait (1|un) mois\b/.test(t)) {
    return 1;
  }
  const m2 = t.match(/ca fait\s+(\d+)\s+mois/);
  if (m2) return Number(m2[1]);
  if (/\bdepuis (2|deux|3|trois|4|quatre|5|cinq|6|six) mois\b/.test(t)) {
    const words: Record<string, number> = {
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
    };
    for (const [w, n] of Object.entries(words)) {
      if (t.includes(`depuis ${w} mois`)) return n;
    }
  }
  if (
    /\b(depuis mon entree|depuis l.?emménagement|depuis que j.?ai emmenage|entree dans le logement)\b/.test(
      t,
    )
  ) {
    return null;
  }
  return null;
}

export function parseOccupancyContext(text: string): OccupancyContextSignals {
  const t = normalizeOccupancyText(text);
  const monthsSinceMoveIn = parseMonthsSinceMoveIn(t);

  const mentionsRemiseEnEtat = /\b(remise en etat|remis en etat|travaux (avant|lors)|entreprise (de )?travaux)\b/.test(
    t,
  );

  const mentionsNewHandover =
    /\b(residence neuve|livraison neuve|logement neuf|remise en etat neuve|construction recente|immeuble neuf)\b/.test(
      t,
    );

  const mentionsGpa =
    /\b(gpa|garantie de parfait achevement|parfait achevement)\b/.test(t);

  const problemSinceMoveIn =
    /\b(depuis (mon entree|l.?emménagement|que je suis|que j.?ai emmenage)|des l.?entree|ne marche pas depuis|panne depuis|present depuis l.?entree)\b/.test(
      t,
    ) || (monthsSinceMoveIn != null && monthsSinceMoveIn <= POST_HANDOVER_REPAIR_WINDOW_MONTHS);

  const withinSixMonthsOfMoveIn =
    (monthsSinceMoveIn != null &&
      monthsSinceMoveIn <= POST_HANDOVER_REPAIR_WINDOW_MONTHS) ||
    /\b(moins de 6 mois|moins de six mois|dans les 6 premiers mois)\b/.test(t) ||
    (problemSinceMoveIn &&
      /\b(depuis mon entree|emménagement|entree)\b/.test(t) &&
      monthsSinceMoveIn == null);

  const smallRepairsMissedAtHandover =
    mentionsRemiseEnEtat &&
    /\b(menues reparations|petites reparations|reparations locatives).*(pas bien fait|mal fait|oublie|non fait)/.test(
      t,
    );

  const handoverWorkmanshipDefect =
    mentionsRemiseEnEtat &&
    (/\b(sans (lumiere|electricite)|pas d.?electricite|pas de lumiere)\b/.test(t) ||
      /\b(douille|support|plafonnier).*(pose|monte|installe|mal fix)\b/.test(t) ||
      /\b(sans (faire )?test|pas teste)\b/.test(t));

  return {
    mentionsRemiseEnEtat,
    mentionsNewHandover,
    mentionsGpa,
    monthsSinceMoveIn,
    withinSixMonthsOfMoveIn,
    problemSinceMoveIn,
    smallRepairsMissedAtHandover,
    handoverWorkmanshipDefect,
  };
}

/** Défaut probablement lié à la remise en état ou à la période post-entrée (≤ 6 mois). */
export function isPostHandoverBailleurDefect(
  ctx: OccupancyContextSignals,
): boolean {
  if (ctx.handoverWorkmanshipDefect || ctx.smallRepairsMissedAtHandover) {
    return true;
  }
  if (
    ctx.withinSixMonthsOfMoveIn &&
    ctx.problemSinceMoveIn &&
    (ctx.mentionsRemiseEnEtat || ctx.monthsSinceMoveIn != null)
  ) {
    return true;
  }
  if (ctx.mentionsNewHandover && (ctx.mentionsGpa || ctx.problemSinceMoveIn)) {
    return true;
  }
  return false;
}

export function formatOccupancyContextBrief(
  ctx: OccupancyContextSignals,
  warrantyBlock?: string,
): string {
  const lines: string[] = ['=== Contexte entrée / remise en état ==='];
  if (ctx.monthsSinceMoveIn != null) {
    lines.push(`Depuis l’entrée (texte) : ~${ctx.monthsSinceMoveIn} mois`);
  }
  if (ctx.withinSixMonthsOfMoveIn) {
    lines.push(
      `Fenêtre ${POST_HANDOVER_REPAIR_WINDOW_MONTHS} mois : menues réparations mal faites à la remise en état → charge bailleur probable`,
    );
  }
  if (ctx.mentionsRemiseEnEtat) {
    lines.push('Remise en état mentionnée');
  }
  if (ctx.smallRepairsMissedAtHandover) {
    lines.push('Menues réparations non correctement faites à la remise en état');
  }
  if (ctx.handoverWorkmanshipDefect) {
    lines.push('Défaut de pose / travaux sans électricité sur chantier');
  }
  if (ctx.mentionsNewHandover || ctx.mentionsGpa) {
    lines.push(
      'Remise en état neuve / GPA : vérifier garantie de parfait achèvement (≈ 1 an après livraison)',
    );
  }
  if (warrantyBlock) {
    lines.push(warrantyBlock);
  }
  return lines.join('\n');
}
