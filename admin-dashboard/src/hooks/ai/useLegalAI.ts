import { useCallback, useMemo } from 'react';
import { LEGAL_AI_FINAL_CATCHPHRASE_FR } from './legalDisclaimer';
import type { LegalAnalysisInput } from './executeAIPipeline';

/** Problème classé comme plutôt « locatif », « bailleur » ou zone « flou » (information seule). */
export type RentalProblemOrientation = 'locatif' | 'bailleur' | 'flou';

function classifyRentalProblem(text: string): RentalProblemOrientation {
  const t = text.toLowerCase();
  const bailleurHints =
    /\b(?:toit|charpente|façade|infiltration\s+ma[cç]onn|gros\s+[œoe]uvre|parties?\s+communes|étanchéité\s+rampante|vide\s*d['’]?eau\s+collectif|chauffage\s+central\s+d['’]?immeuble)/i.test(
      t,
    );
  const locatifHints =
    /\b(?:ménage|casse\s+après\s+emménagement|vie\s+courante|vaisselle|propreté\s+du\s+logement\s+après\s+usage)/i.test(
      t,
    );

  if (bailleurHints && !locatifHints) return 'bailleur';
  if (locatifHints && !bailleurHints) return 'locatif';

  const mixed =
    /\b(?:humidité|moisissure|fuite|prises?|disjonct|serrure|fenêtre|radiateur)/i.test(
      t,
    );
  if (mixed) return 'flou';

  return 'flou';
}

/**
 * IA Juridique informative (rectifiée) — cadre légal général + références à consulter sur les textes officiels,
 * sans conseil personnalisé, sans lecture de contrat, sans prescription.
 */
export function useLegalAI() {
  const buildInformativeRentalBrief = useCallback(
    (inp: LegalAnalysisInput, opts: { hostileTone: boolean }): string => {
      const orientation = classifyRentalProblem(inp.cleanedText);

      const citations =
        'Références générales (à **vérifier sur Légifrance** avec la date à laquelle vous consultez les textes) : Code civil concernant les baux à usage d‘habitation (obligations de délivrance et d’entretien), loi n° 89-462 du 6 juillet 1989 tendant à améliorer les rapports locatifs, décrets d’application et la réglementation applicable selon le type de logement (vide, meublé, pinel, etc.).';

      const landlordObligations =
        '**Obligations typiques du bailleur (grandes lignes)** : délivrance d’un logement conforme et entretien des éléments indissociables du gros œuvre / équipements d’usage commun selon qualification exacte prévue par la loi.';

      const tenantObligations =
        '**Obligations typiques du locataire (grandes lignes)** : respect de la destination du logement, paiement du loyer et des charges légales/conventionnelles, entretien courant et petite réparation hors grosses interventions imputables au bailleur selon qualification légale.';

      const recours =
        '**Recours possibles (informations générales)** : **CLCV**, **ADIL**, conciliation ou médiation, orientation vers un juriste ou avocat.';

      let blocOrientation = '';
      if (orientation === 'bailleur') {
        blocOrientation =
          '**Qualification automatique indicative** : *bailleur* — problème souvent rattaché à la bonne jouissance générale ou à la structure du bien / parties communes (à confirmer par un intervenant agréé, sans extrapolation personnelle à partir de vos faits précis).';
      } else if (orientation === 'locatif') {
        blocOrientation =
          '**Qualification automatique indicative** : *locatif* — thème pouvant être lié à l’usage courant ou à l’entretien léger inhérent à l’occupation (confirmation factuelle indispensable).';
      } else {
        blocOrientation =
          '**Qualification automatique indicative** : *flou* — plusieurs textes peuvent se superposer ; seule une analyse factuelle par un professionnel qualifié permet de classer la situation sans se substituer à votre contrat ou à un litige réel.';
      }

      const calm = opts.hostileTone
        ? 'Nous comprenons que la situation peut être frustrante. Voici une **explication simple et courte**, sans jugement sur votre situation personnelle.\n\n'
        : '';

      const aggressive = /\b(?:merde|conne|conard|nul|incompétent)\b/i.test(
        inp.cleanedText,
      );
      const reformulate = aggressive
        ? '**Reformulation non agressive** : vous signalez un souci lié au logement et souhaitez comprendre le cadre général des obligations et des recours.\n\n'
        : '';

      return [
        calm,
        reformulate,
        blocOrientation,
        '\n\n',
        citations,
        '\n\n',
        landlordObligations,
        '\n',
        tenantObligations,
        '\n\n',
        recours,
        '\n\n',
        'Ce contenu **n’est pas** un conseil juridique personnalisé, **n’interprète pas** votre bail et **ne tranche aucun litige**.\n',
        LEGAL_AI_FINAL_CATCHPHRASE_FR,
      ]
        .filter(Boolean)
        .join('');
    },
    [],
  );

  return useMemo(
    () => ({
      buildInformativeRentalBrief,
      finalCatchphrase: LEGAL_AI_FINAL_CATCHPHRASE_FR,
    }),
    [buildInformativeRentalBrief],
  );
}
