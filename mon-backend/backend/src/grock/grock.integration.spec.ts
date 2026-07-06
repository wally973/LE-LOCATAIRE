import { GrockService } from './grock.service';
import { SocialHousingGuyanePack } from './domain/social-housing-guyane.pack';
import { GrockPreprocessorService } from './preprocessor/grock-preprocessor.service';
import { GROCK_PATHOLOGY_ASSISTANT_PROMPT } from './grock-pathology.prompt';
describe('GrockService intégration prompt/domain/vision/note_interne', () => {
  it('valide un cas réel infiltration avec domaine non verrouillé, vision croisée et note_interne', async () => {
    const captured: {
      visionPrompt?: string;
      visionContext?: string;
      systemPrompt?: string;
      reasoningSawImage?: boolean;
    } = {};

    // Faux PORT IA (Couche 1) : le noyau Grock ne parle qu'à cette interface.
    const operator = {
      isConfigured: () => true,
      describeFailure: () => 'indisponible',
      see: async (req: {
        systemPrompt: string;
        userText: string;
      }): Promise<{ text: string; model: string }> => {
        captured.visionPrompt = req.systemPrompt;
        captured.visionContext = req.userText;
        return {
          text: [
            '- DISPOSITION : zone de buanderie, trace visible en hauteur.',
            '- SÉMANTIQUE : récipient au sol, possible récupération déclarée.',
            '- HAUTE DÉFINITION : surface partiellement sèche.',
            '- Hypothèse déclarée locataire : infiltration dans la buanderie.',
          ].join('\n'),
          model: 'vision-test',
        };
      },
      reason: async (req: {
        systemPrompt: string;
        images?: unknown[];
      }): Promise<{ text: string; model: string }> => {
        captured.systemPrompt = req.systemPrompt;
        captured.reasoningSawImage = Boolean(req.images?.length);
        return {
          text: JSON.stringify({
            thinking:
              'Observation infiltration buanderie ; domaine dominant humidité non verrouillé ; croisement récit/photo ; usage locataire et recours assurance considérés.',
            scores: {
              factExtractionConfidence: 7,
              dangerLevel: 2,
              realityCheckConfidence: 6,
              inferenceConfidence: 5,
              decisionConfidence: 5,
              communicationIntensity: 2,
            },
            state: 'ASK_ONE_QUESTION',
            next_action: 'Demander où la trace apparaît exactement.',
            acknowledgment:
              'La trace est plutôt au plafond, au mur ou au sol de la buanderie ?',
            note_interne:
              'Infiltration buanderie : responsabilité bailleur probable ; documenter tiers, assurance et preuves photo.',
          }),
          model: 'mistral-test',
        };
      },
    };

    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const preprocessor = new GrockPreprocessorService(operator as never);
    const service = new GrockService(
      operator as never,
      new SocialHousingGuyanePack(),
      preprocessor,
      prisma as never,
    );
    const result = await service.runTurn({
      tenantFirstName: 'Marie',
      title: 'Toiture / infiltration',
      description: 'J’ai une infiltration dans la buanderie',
      ticketHistory: [],
      sessionMessages: [],
      tenantMessage: 'J’ai une infiltration dans la buanderie',
      mode: 'tenant_turn',
      images: [{ mimeType: 'image/jpeg', base64: 'ZmFrZQ==' }],
    });

    const systemPrompt = captured.systemPrompt ?? '';

    expect(systemPrompt).toContain('--- Domaine dominant (non verrouillé) ---');
    expect(systemPrompt).toContain('version industrielle');
    expect(systemPrompt).toContain('COUCHE 2');
    expect(systemPrompt).toContain('ANALYSE');
    expect(systemPrompt).toContain('VÉRIFICATION');
    expect(systemPrompt).toMatch(/D[EÉ]DUCTION/);
    expect(systemPrompt).toContain('DÉCISION');
    expect(systemPrompt).toContain('RÉSOLUTION');
    // Le faux Arbor ne doit plus apparaître dans le prompt maître.
    expect(systemPrompt).not.toContain('ARBOR');
    expect(systemPrompt.toLowerCase()).toContain('climat tropical');
    expect(systemPrompt.toLowerCase()).toContain('bailleur');
    expect(systemPrompt.toLowerCase()).toContain('locataire');
    expect(systemPrompt).toContain('"thinking"');
    expect(systemPrompt).toContain('"state"');
    expect(systemPrompt).toContain('"next_action"');
    expect(systemPrompt).toContain('"acknowledgment"');
    expect(systemPrompt).toContain('signalQuality');
    expect(systemPrompt).toContain('"scores"');
    expect(systemPrompt).toContain('Couche 0 · signal textuel préparé');
    expect(systemPrompt).toContain('Tête 3 · DÉDUCTION');
    expect(systemPrompt).toContain('infiltration_score');
    expect(systemPrompt).toContain('sinistre_probable');
    expect(systemPrompt).toContain('Tête 5 · RÉSOLUTION');
    expect(systemPrompt).not.toContain('Couche 0 · piste procédure sinistre');
    expect(systemPrompt).toContain('Savoir métier logement social');
    expect(captured.visionPrompt).toContain('Préprocesseur visuel');
    expect(captured.visionPrompt).toContain('Invariant cadrage');
    // Perception AVEUGLE AU CADRAGE : le récit orienté du locataire ne doit PAS
    // être transmis au modèle de vision (sinon il teinte la lecture des pixels).
    expect(captured.visionContext).not.toContain(
      'J’ai une infiltration dans la buanderie',
    );
    expect(captured.visionContext).toContain('objectivement visible');
    // Étape 2 : le raisonnement VOIT l'image (fin du jeu du téléphone).
    expect(captured.reasoningSawImage).toBe(true);
    expect(GROCK_PATHOLOGY_ASSISTANT_PROMPT).toContain(
      'Usage du locataire (obligatoire)',
    );
    expect(result.acknowledgment).toBe(
      'La trace est plutôt au plafond, au mur ou au sol de la buanderie ?',
    );
    expect(result.noteInterne).toContain('responsabilité bailleur probable');
    // 2 écritures : le message Grock + le journal de décision (boucle d'apprentissage).
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });
});
