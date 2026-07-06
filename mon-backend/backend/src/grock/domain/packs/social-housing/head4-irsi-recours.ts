import type { Head3DeductionInput, IrsiOriginKind, IrsiRecoursHint } from '../../../domain/head-pack.contract';
import type { Head1AnalysisInput } from '../../../head-input/head-input.types';

/**
 * IRSI / recours — matière Tête 4 (doctrine, pas de promesse d’indemnisation).
 */
export function buildIrsiRecoursHint(
  head1: Head1AnalysisInput,
  head3: Head3DeductionInput,
  corpus: string,
): IrsiRecoursHint | null {
  if (!head3.sinistre_probable && head3.degat_des_eaux_score < 6) return null;

  const originKind = resolveIrsiOriginKind(head1, head3, corpus);

  switch (originKind) {
    case 'parties_communes':
      return {
        originKind,
        gestionnaire: 'assurance du bailleur (patrimoine / parties communes)',
        recours: 'recours possible contre l’assurance du tiers responsable si origine tiers identifiée',
      };
    case 'voisin':
      return {
        originKind,
        gestionnaire: 'assurance habitation du logement victime (locataire)',
        recours: 'recours contre l’assurance du voisin responsable (constat amiable entre voisins)',
      };
    case 'privative_locataire':
      return {
        originKind,
        gestionnaire: 'assurance habitation du locataire',
        recours: 'pas de recours tiers — entretien / usage privatif',
      };
    case 'entreprise':
      return {
        originKind,
        gestionnaire: 'assurance du logement victime ou du bailleur selon responsabilité',
        recours: 'recours contre l’assurance de l’entreprise responsable',
      };
    case 'tiers_exterieur':
      return {
        originKind,
        gestionnaire: 'assurance du logement victime ou du bailleur',
        recours: 'recours contre l’assurance du tiers extérieur identifié',
      };
  }

  return {
    originKind: 'incertaine',
    gestionnaire: 'assurance habitation du logement victime (locataire)',
    recours: 'recours selon origine identifiée après diagnostic / constat',
  };
}

function resolveIrsiOriginKind(
  head1: Head1AnalysisInput,
  head3: Head3DeductionInput,
  corpus: string,
): IrsiOriginKind {
  if (/entreprise|artisan|chantier/i.test(corpus)) return 'entreprise';
  if (/rue|voirie|terrasse|extérieur|exterieur/i.test(corpus)) return 'tiers_exterieur';
  if (head1.symptomAnchor === 'équipement sanitaire' && !head1.ceilingSignal) {
    return 'privative_locataire';
  }

  const scores = [
    { kind: 'voisin' as const, score: head3.origine_voisin_score },
    { kind: 'parties_communes' as const, score: head3.origine_toiture_score },
  ].sort((a, b) => b.score - a.score);

  if (head3.neighborInvolved || scores[0]?.kind === 'voisin' && (scores[0]?.score ?? 0) >= 5) {
    return 'voisin';
  }
  if (
    head3.originFromAbove &&
    (scores[0]?.kind === 'parties_communes' && (scores[0]?.score ?? 0) >= 4)
  ) {
    return 'parties_communes';
  }
  if (head3.origine_voisin_score >= 5 && head3.origine_toiture_score >= 5) {
    return 'incertaine';
  }
  return 'incertaine';
}

export function renderIrsiRecoursBlock(hint: IrsiRecoursHint): string {
  return [
    'IRSI / recours (doctrine — ne pas promettre d’indemnisation) :',
    `  • Origine probable : ${hint.originKind}`,
    `  • Gestionnaire indicatif : ${hint.gestionnaire}`,
    `  • Recours : ${hint.recours}`,
  ].join('\n');
}
