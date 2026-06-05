import {
  classifyTripleChargeFlux,
  normalizeLegacyChargeHorizon,
  tripleFluxToDisplayLabel,
  type TripleChargeFlux,
} from '../../../ai/lia-triple-flux-charge';
import type {
  LivingBuildingState,
  LivingLegalVerdict,
} from './living-building-state.types';

/** Applique le tri triple flux souverain sur le verdict Archiviste. */
export function applySovereignTripleFluxToLegalVerdict(
  state: LivingBuildingState,
): LivingBuildingState {
  const classified = classifyTripleChargeFlux({
    title: state.signalementTitle,
    description: state.signalementDescription,
    message: state.lastTenantMessage ?? '',
    activeFlows: state.vision3d.activeFlows,
    tradeNeeded: state.intervention.tradeNeeded,
  });

  const llmFlux = normalizeLegacyChargeHorizon(
    String(state.legalVerdict.chargeHorizon),
  );
  const flux: TripleChargeFlux =
    classified.confidence >= 0.65
      ? classified.flux
      : llmFlux !== 'INDETERMINE'
        ? llmFlux
        : classified.flux;

  const articles = [...state.legalVerdict.articles];
  for (const code of classified.legalBasis) {
    if (!articles.some((a) => a.code === code || a.label.includes(code))) {
      articles.push({
        code:
          code === '1719' ? '1719' : code === '87-713' ? '87-713' : '87-712',
        label:
          code === '1719'
            ? 'Art. 1719 CC — patrimoine bailleur'
            : code === '87-713'
              ? 'Décret 87-713 — charges récupérables'
              : 'Décret 87-712 — réparations locatives',
        applies: true,
        rationale: classified.afpolGrounding,
      });
    }
  }

  const legalVerdict: LivingLegalVerdict = {
    ...state.legalVerdict,
    chargeHorizon: flux,
    articles,
    summary:
      state.legalVerdict.summary ||
      `${tripleFluxToDisplayLabel(flux)} — ${classified.archivisteSummary}`,
    tenantChargeExplanation: classified.tenantExplanationFr,
    afpolGrounding: classified.afpolGrounding,
  };

  return {
    ...state,
    legalVerdict,
    humanBarrier: {
      ...state.humanBarrier,
      extractedFacts: {
        ...state.humanBarrier.extractedFacts,
        charge_triple_flux: tripleFluxToDisplayLabel(flux),
        conseil_charge_marie:
          classified.tenantExplanationFr.slice(0, 400),
      },
    },
  };
}
