import { serializePreprocessedSignalForJournal } from './preprocessed-signal.serializer';
import type { PreprocessedSignal } from './preprocessor.types';

describe('serializePreprocessedSignalForJournal', () => {
  it('produit un snapshot sans fil conversationnel complet', () => {
    const signal: PreprocessedSignal = {
      tenantFirstName: 'Marie',
      title: 'Fuite',
      description: 'Eau au plafond',
      tenantMessage: 'fuite',
      sessionMessages: [
        { id: '1', role: 'user', text: 'hello', createdAt: new Date() },
        { id: '2', role: 'assistant', text: 'bonjour', createdAt: new Date() },
      ],
      interlocutor: 'tenant',
      signalementBlock: 'block',
      visualPerceptionRaw: 'mur humide',
      visionModel: 'pixtral',
      signalQuality: 7,
      signalQualityFactors: {
        textCoherence: 7,
        textAmbiguityPenalty: 0,
        imageQuality: 6,
        hasImage: true,
        perceptionAvailable: true,
      },
      meta: { role: 'tenant', textFieldsNormalized: 1, imageProcessed: true },
    };

    const snap = serializePreprocessedSignalForJournal(signal);
    expect(snap.sessionTurnCount).toBe(2);
    expect(snap.signalQuality).toBe(7);
    expect(snap).not.toHaveProperty('sessionMessages');
  });
});
