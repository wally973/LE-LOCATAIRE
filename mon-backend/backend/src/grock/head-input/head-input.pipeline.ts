import type { GrockDomainPack } from '../domain/domain-pack.port';
import type { PreprocessedSignal } from '../preprocessor/preprocessor.types';
import { buildSignalCorpus } from './corpus.util';
import { buildHead1AnalysisInput, renderHead1PromptBlock } from './head1-analysis.input';
import { buildHead2VerificationInput, renderHead2PromptBlock } from './head2-verification.input';
import type { GrockHeadInputs } from './head-input.types';
import type { HeadInputsJournalSnapshot } from '../domain/head-pack.contract';

function stripPromptBlock<T extends { promptBlock: string }>(
  out: T,
): Omit<T, 'promptBlock'> {
  const { promptBlock: _drop, ...rest } = out;
  return rest;
}

/**
 * Pipeline capteurs par tête — chaîne T1→T5 après Couche 0.
 * T1/T2 = noyau générique ; T3–T5 = pack métier (Couche 3).
 */
export function buildGrockHeadInputs(
  signal: PreprocessedSignal,
  domainPack: Pick<
    GrockDomainPack,
    'enrichHead3' | 'enrichHead4' | 'enrichHead5'
  >,
): GrockHeadInputs {
  const head1 = buildHead1AnalysisInput(signal);
  const head2 = buildHead2VerificationInput(signal, head1);
  const ctx = {
    signal,
    head1,
    head2,
    corpus: buildSignalCorpus(signal),
  };

  const head3Out = domainPack.enrichHead3(ctx);
  const head4Out = domainPack.enrichHead4(ctx, head3Out);
  const head5Out = domainPack.enrichHead5(ctx, head3Out, head4Out);

  const promptBlocks = [
    renderHead1PromptBlock(head1),
    renderHead2PromptBlock(head2, head1),
    head3Out.promptBlock,
    head4Out.promptBlock,
    head5Out.promptBlock,
  ];

  return {
    head1,
    head2,
    head3: stripPromptBlock(head3Out),
    head4: stripPromptBlock(head4Out),
    head5: stripPromptBlock(head5Out),
    promptBlocks,
  };
}

export function serializeHeadInputsForJournal(
  inputs: GrockHeadInputs,
  domainPack: Pick<GrockDomainPack, 'serializeHeadInputsJournal'>,
): HeadInputsJournalSnapshot {
  return domainPack.serializeHeadInputsJournal(inputs);
}
