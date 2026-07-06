import { buildHead3DeductionInput, renderHead3PromptBlock } from './head3-deduction.input';
import { buildHead4DecisionInput, renderHead4PromptBlock } from './head4-decision.input';
import { buildHead5ResolutionInput, renderHead5PromptBlock } from './head5-resolution.input';
import type {
  Head3PackOutput,
  Head4PackOutput,
  Head5PackOutput,
  HeadEnrichmentContext,
} from '../../head-enrichment.types';

/**
 * Enrichissement T3–T5 — pack « Logement social » (Couche 3).
 */
export function enrichHead3SocialHousing(ctx: HeadEnrichmentContext): Head3PackOutput {
  const head3 = buildHead3DeductionInput(ctx.signal, ctx.head1, ctx.head2);
  return { ...head3, promptBlock: renderHead3PromptBlock(head3) };
}

export function enrichHead4SocialHousing(
  ctx: HeadEnrichmentContext,
  head3: Head3PackOutput,
): Head4PackOutput {
  const head4 = buildHead4DecisionInput(ctx.head1, head3, ctx.signal);
  return { ...head4, promptBlock: renderHead4PromptBlock(head4) };
}

export function enrichHead5SocialHousing(
  ctx: HeadEnrichmentContext,
  head3: Head3PackOutput,
  head4: Head4PackOutput,
): Head5PackOutput {
  const head5 = buildHead5ResolutionInput(head3, head4, ctx.signal.interlocutor);
  return { ...head5, promptBlock: renderHead5PromptBlock(head5) };
}
