import type { GrockChatMessage } from '../grock.service';

/** Corpus textuel unifié pour les capteurs par tête. */
export function buildSignalCorpus(params: {
  title: string;
  description: string;
  tenantMessage: string;
  sessionMessages: GrockChatMessage[];
  visualPerceptionRaw: string | null;
}): string {
  return [
    params.title,
    params.description,
    params.tenantMessage,
    ...params.sessionMessages.map((m) => m.text),
    params.visualPerceptionRaw ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}
