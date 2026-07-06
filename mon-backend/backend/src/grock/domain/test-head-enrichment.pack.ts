import type { GrockDomainPack } from './domain-pack.port';
import {
  enrichHead3Empty,
  enrichHead4Empty,
  enrichHead5Empty,
} from './empty-head-enrichment';
import { applyParoleSupplementsEmpty } from './empty-parole-supplement';
import { serializeEmptyHeadInputsJournal } from './serialize-empty-head-journal';
import {
  enrichHead3SocialHousing,
  enrichHead4SocialHousing,
  enrichHead5SocialHousing,
} from './packs/social-housing/head-enrichment';
import { serializeSocialHousingHeadInputsJournal } from './packs/social-housing/serialize-head-journal';
import { applySocialHousingParoleSupplements } from './packs/social-housing/apply-parole-supplements';

type HeadPackBridge = Pick<
  GrockDomainPack,
  | 'enrichHead3'
  | 'enrichHead4'
  | 'enrichHead5'
  | 'serializeHeadInputsJournal'
  | 'applyParoleSupplements'
>;

/** Pont pack logement social pour tests unitaires (sans Nest). */
export const socialHousingHeadEnrichmentPack: HeadPackBridge = {
  enrichHead3: enrichHead3SocialHousing,
  enrichHead4: enrichHead4SocialHousing,
  enrichHead5: enrichHead5SocialHousing,
  serializeHeadInputsJournal: serializeSocialHousingHeadInputsJournal,
  applyParoleSupplements: applySocialHousingParoleSupplements,
};

/** Pack neutre — aucun métier sinistre / logement. */
export const emptyHeadEnrichmentPack: HeadPackBridge = {
  enrichHead3: () => enrichHead3Empty(),
  enrichHead4: () => enrichHead4Empty(),
  enrichHead5: (ctx) => enrichHead5Empty(ctx.signal.interlocutor),
  serializeHeadInputsJournal: serializeEmptyHeadInputsJournal,
  applyParoleSupplements: applyParoleSupplementsEmpty,
};
