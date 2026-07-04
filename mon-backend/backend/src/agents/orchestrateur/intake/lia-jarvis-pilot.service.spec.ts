jest.mock('../living-intelligence/living-intelligence.config', () => ({
  isLivingIntelligenceEnabled: () => true,
}));

import { LiaIntakeService, buildIntakePayload } from './lia-intake.service';
import type { GrockConversationState } from '../../../grock/grock.service';
import {
  LiaJarvisPilotService,
  type JarvisPilotTurn,
} from './lia-jarvis-pilot.service';
import type { LivingReasoningService } from '../living-intelligence/living-reasoning.service';

describe('LiaJarvisPilotService.runTenantTurn', () => {
  const intake = new LiaIntakeService();
  let runTurnMock: jest.Mock;

  const baseParams = {
    title: "Pas de courant dans la cuisine",
    description: 'Les prises ne fonctionnent plus',
    tenantFirstName: 'Marie',
  };

  function buildPilot() {
    runTurnMock = jest.fn().mockResolvedValue({
      state: {
        ...intake.createInitialState(baseParams.title, baseParams.description),
        intakeMode: 'jarvis' as const,
        answers: {
          jarvis_intake_complete: 'non',
          grock_last_tenant_message: 'undisjoncteur est vers le bas',
        },
      },
      acknowledgment: 'Le disjoncteur est-il en position basse ?',
      nextQuestion: null,
      fromLlm: true,
      grockState: 'ASK_ONE_QUESTION' as GrockConversationState,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = {
      runTurn: runTurnMock,
    } as unknown as LivingReasoningService;
    const handoff = {
      dispatchSectorTechnician: jest.fn(),
      dispatchSocialReferral: jest.fn(),
      dispatchArtisanReferral: jest.fn(),
    };
    const diagnosticContext = {
      fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }),
    };
    const conversation = {
      appendMessage: jest.fn().mockResolvedValue({}),
    };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn().mockResolvedValue(undefined),
      finalizeTicketAsNonRecevable: jest.fn().mockResolvedValue(undefined),
    };

    return {
      pilot: new LiaJarvisPilotService(
        intake,
        handoff as never,
        diagnosticContext as never,
        livingReasoning,
        conversation as never,
        ticketFinalizer as never,
      ),
      conversation,
      ticketFinalizer,
      handoff,
    };
  }

  it('initialise grockAlreadyCalled et lastGrockReply dans l’état ticket', () => {
    const state = intake.createInitialState(baseParams.title, baseParams.description);
    expect(state.grockAlreadyCalled).toBe(false);
    expect(state.lastGrockReply).toBeNull();

    const payload = buildIntakePayload(state) as { intake: typeof state };
    expect(payload.intake.grockAlreadyCalled).toBe(false);
    expect(payload.intake.lastGrockReply).toBeNull();
  });

  it('ne rappelle pas Grock sur un second runTenantTurn avec le même message', async () => {
    const { pilot } = buildPilot();
    let state = intake.createInitialState(baseParams.title, baseParams.description);
    state = {
      ...state,
      intakeMode: 'jarvis',
      answers: { ...state.answers, jarvis_intake_complete: 'non' },
    };
    const message = 'undisjoncteur est vers le bas';

    const first = await pilot.runTenantTurn({ ...baseParams, state, message });
    const second = await pilot.runTenantTurn({
      ...baseParams,
      state: first.state,
      message,
    });

    expect(runTurnMock).toHaveBeenCalledTimes(1);
    expect(second.acknowledgment).toBe(first.acknowledgment);
    expect(second).toBe(first.state.lastGrockReply);
    expect(first.state.grockAlreadyCalled).toBe(true);
  });

  it('réinitialise le garde-fou quand le locataire envoie un nouveau message', async () => {
    const { pilot } = buildPilot();
    let state = intake.createInitialState(baseParams.title, baseParams.description);
    state = { ...state, intakeMode: 'jarvis' };

    const first = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: 'undisjoncteur est vers le bas',
    });
    await pilot.runTenantTurn({
      ...baseParams,
      state: first.state,
      message: 'je viens de le remonter',
    });

    expect(runTurnMock).toHaveBeenCalledTimes(2);
  });

  it('auto-conclut et transmet au technicien si Grock renvoie bailleur_responsable', async () => {
    runTurnMock = jest.fn().mockResolvedValue({
      state: intake.createInitialState(baseParams.title, baseParams.description),
      acknowledgment:
        'Marie, l’installation électrique relève du bailleur — je transmets votre dossier.',
      nextQuestion: null,
      fromLlm: true,
      grockState: 'bailleur_responsable' as GrockConversationState,
      grockNextAction: 'Transmission technicien secteur',
      handoffTriggered: true,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = { runTurn: runTurnMock } as unknown as LivingReasoningService;
    const handoff = {
      dispatchSectorTechnician: jest.fn(),
      dispatchSocialReferral: jest.fn(),
      dispatchArtisanReferral: jest.fn(),
    };
    const conversation = { appendMessage: jest.fn().mockResolvedValue({}) };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn().mockResolvedValue(undefined),
      finalizeTicketAsNonRecevable: jest.fn().mockResolvedValue(undefined),
    };
    const pilot = new LiaJarvisPilotService(
      intake,
      handoff as never,
      { fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }) } as never,
      livingReasoning,
      conversation as never,
      ticketFinalizer as never,
    );

    const state = {
      ...intake.createInitialState(baseParams.title, baseParams.description),
      intakeMode: 'jarvis' as const,
    };
    const result = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: 'disjoncteur général en bas',
      ticketId: 79,
    });

    // INV2 : le message affiché est la parole de Grock (acknowledgment), pas next_action.
    const bailleurAck =
      'Marie, l’installation électrique relève du bailleur — je transmets votre dossier.';
    expect(conversation.appendMessage).toHaveBeenCalledTimes(1);
    expect(conversation.appendMessage).toHaveBeenCalledWith(
      79,
      'LIA_HOST',
      bailleurAck,
      'fr-FR',
      expect.any(Object),
    );
    expect(ticketFinalizer.finalizeTicketForBailleur).toHaveBeenCalledTimes(1);
    expect(handoff.dispatchSectorTechnician).not.toHaveBeenCalled();
    expect(result.autoConclusionApplied).toBe(true);
    expect(result.acknowledgment).toBe(bailleurAck);
    expect(result.state.phase).toBe('DONE');
    expect(result.state.answers.jarvis_intake_complete).toBe('oui');
  });

  it('auto-conclut en non recevable si Grock renvoie locataire_responsable', async () => {
    runTurnMock = jest.fn().mockResolvedValue({
      state: intake.createInitialState(baseParams.title, baseParams.description),
      acknowledgment: 'Ampoule à remplacer par vos soins.',
      nextQuestion: null,
      fromLlm: true,
      grockState: 'locataire_responsable' as GrockConversationState,
      handoffTriggered: false,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = { runTurn: runTurnMock } as unknown as LivingReasoningService;
    const conversation = { appendMessage: jest.fn().mockResolvedValue({}) };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn(),
      finalizeTicketAsNonRecevable: jest.fn().mockResolvedValue(undefined),
    };
    const pilot = new LiaJarvisPilotService(
      intake,
      {
        dispatchSectorTechnician: jest.fn(),
        dispatchSocialReferral: jest.fn(),
        dispatchArtisanReferral: jest.fn(),
      } as never,
      { fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }) } as never,
      livingReasoning,
      conversation as never,
      ticketFinalizer as never,
    );

    const state = {
      ...intake.createInitialState(baseParams.title, baseParams.description),
      intakeMode: 'jarvis' as const,
      category: 'ELECTRICITY' as const,
    };
    const result = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: 'j’ai changé l’ampoule mais ça ne marche toujours pas',
      ticketId: 80,
    });

    expect(conversation.appendMessage).toHaveBeenCalledTimes(1);
    expect(ticketFinalizer.finalizeTicketAsNonRecevable).toHaveBeenCalledWith(
      80,
      expect.objectContaining({
        reason: 'usage_locataire',
        category: 'ELECTRICITY',
        domain: 'locataire_responsable',
      }),
    );
    expect(ticketFinalizer.finalizeTicketForBailleur).not.toHaveBeenCalled();
    expect(result.autoConclusionApplied).toBe(true);
    expect(result.handoffTriggered).toBe(false);
    // INV2 : le message affiché est la parole de Grock.
    expect(result.acknowledgment).toBe('Ampoule à remplacer par vos soins.');
  });

  it('sinistre — Grock réclame une preuve : on sonde (parole de Grock), pas de transmission', async () => {
    const grockAck =
      'Coupez l’électricité dans les pièces touchées et n’y touchez plus. ' +
      'Déclarez le sinistre à votre assurance sous 5 jours ouvrés. ' +
      'Envoyez-moi une photo du plafond pour confirmer l’origine avant transmission au technicien.';
    runTurnMock = jest.fn().mockResolvedValue({
      state: intake.createInitialState(baseParams.title, baseParams.description),
      acknowledgment: grockAck,
      nextQuestion: null,
      fromLlm: true,
      grockState: 'sinistre' as GrockConversationState,
      grockNoteInterne: 'Sinistre dégât des eaux.',
      handoffTriggered: true,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = { runTurn: runTurnMock } as unknown as LivingReasoningService;
    const conversation = { appendMessage: jest.fn().mockResolvedValue({}) };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn(),
      finalizeTicketForSinistre: jest.fn().mockResolvedValue(undefined),
      finalizeTicketAsNonRecevable: jest.fn(),
    };
    const pilot = new LiaJarvisPilotService(
      intake,
      {
        dispatchSectorTechnician: jest.fn(),
        dispatchSocialReferral: jest.fn(),
        dispatchArtisanReferral: jest.fn(),
      } as never,
      { fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }) } as never,
      livingReasoning,
      conversation as never,
      ticketFinalizer as never,
    );

    const state = {
      ...intake.createInitialState(baseParams.title, baseParams.description),
      intakeMode: 'jarvis' as const,
      category: 'PLUMBING' as const,
    };
    const result = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: "j'ai de l'eau qui tombe du plafond dans les ampoules",
      ticketId: 81,
    });

    // INV1 : on n'a PAS encore transmis (preuve avant conclusion).
    expect(ticketFinalizer.finalizeTicketForSinistre).not.toHaveBeenCalled();
    expect(ticketFinalizer.finalizeTicketForBailleur).not.toHaveBeenCalled();
    expect(result.autoConclusionApplied).toBe(true);
    expect(result.handoffTriggered).toBe(false);
    // INV2 : le message affiché est EXACTEMENT la parole de Grock (aucun texte codé).
    expect(result.acknowledgment).toBe(grockAck);
    expect(conversation.appendMessage.mock.calls[0][2]).toBe(grockAck);
    // Le dossier attend la preuve, quel que soit l'état terminal.
    expect(result.state.phase).toBe('AWAITING_PHOTO');
    expect(result.state.jarvisFacts?.awaiting_conclusion_photo).toBe('oui');
    expect(result.state.jarvisFacts?.pending_conclusion).toBe('sinistre');
  });

  it('sinistre — Grock ne réclame pas de preuve : conclusion + transmission (parole de Grock)', async () => {
    const grockAck =
      'Je transmets votre dossier au technicien du bailleur. ' +
      'Déclarez le sinistre à votre assurance sous 5 jours ouvrés.';
    runTurnMock = jest.fn().mockResolvedValue({
      state: intake.createInitialState(baseParams.title, baseParams.description),
      acknowledgment: grockAck,
      nextQuestion: null,
      fromLlm: true,
      grockState: 'sinistre' as GrockConversationState,
      handoffTriggered: true,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = { runTurn: runTurnMock } as unknown as LivingReasoningService;
    const conversation = { appendMessage: jest.fn().mockResolvedValue({}) };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn(),
      finalizeTicketForSinistre: jest.fn().mockResolvedValue(undefined),
      finalizeTicketAsNonRecevable: jest.fn(),
    };
    const pilot = new LiaJarvisPilotService(
      intake,
      {
        dispatchSectorTechnician: jest.fn(),
        dispatchSocialReferral: jest.fn(),
        dispatchArtisanReferral: jest.fn(),
      } as never,
      { fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }) } as never,
      livingReasoning,
      conversation as never,
      ticketFinalizer as never,
    );

    const state = {
      ...intake.createInitialState(baseParams.title, baseParams.description),
      intakeMode: 'jarvis' as const,
      category: 'PLUMBING' as const,
    };
    const result = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: "de l'eau coule du plafond",
      ticketId: 82,
    });

    expect(ticketFinalizer.finalizeTicketForSinistre).toHaveBeenCalledTimes(1);
    expect(result.handoffTriggered).toBe(true);
    expect(result.acknowledgment).toBe(grockAck);
    expect(result.state.phase).toBe('DONE');
  });

  it('sinistre 2e tour (déjà sondé) : conclusion même sans photo', async () => {
    const grockAck = 'C’est transmis au technicien du bailleur.';
    runTurnMock = jest.fn().mockResolvedValue({
      state: intake.createInitialState(baseParams.title, baseParams.description),
      acknowledgment: grockAck,
      nextQuestion: null,
      fromLlm: true,
      grockState: 'sinistre' as GrockConversationState,
      handoffTriggered: true,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = { runTurn: runTurnMock } as unknown as LivingReasoningService;
    const conversation = { appendMessage: jest.fn().mockResolvedValue({}) };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn(),
      finalizeTicketForSinistre: jest.fn().mockResolvedValue(undefined),
      finalizeTicketAsNonRecevable: jest.fn(),
    };
    const pilot = new LiaJarvisPilotService(
      intake,
      {
        dispatchSectorTechnician: jest.fn(),
        dispatchSocialReferral: jest.fn(),
        dispatchArtisanReferral: jest.fn(),
      } as never,
      { fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }) } as never,
      livingReasoning,
      conversation as never,
      ticketFinalizer as never,
    );

    const state = {
      ...intake.createInitialState(baseParams.title, baseParams.description),
      intakeMode: 'jarvis' as const,
      category: 'PLUMBING' as const,
      phase: 'AWAITING_PHOTO' as const,
      jarvisFacts: {
        awaiting_conclusion_photo: 'oui',
        pending_conclusion: 'sinistre',
      },
    };
    const result = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: "je n'ai pas de photo",
      ticketId: 83,
    });

    expect(ticketFinalizer.finalizeTicketForSinistre).toHaveBeenCalledTimes(1);
    expect(result.autoConclusionApplied).toBe(true);
    expect(result.acknowledgment).toBe(grockAck);
  });

  it('bailleur — Grock réclame une photo pour confirmer l’origine : on sonde, on ne conclut pas', async () => {
    const grockAck =
      'La trace de vert-de-gris peut venir d’une infiltration ou de condensation. ' +
      'Envoyez-moi une photo du plafond pour confirmer l’origine avant que je transmette au technicien.';
    runTurnMock = jest.fn().mockResolvedValue({
      state: intake.createInitialState(baseParams.title, baseParams.description),
      acknowledgment: grockAck,
      nextQuestion: null,
      fromLlm: true,
      grockState: 'bailleur_responsable' as GrockConversationState,
      grockNoteInterne: 'Infiltration légère ou condensation. Photo utile pour confirmer.',
      handoffTriggered: true,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = { runTurn: runTurnMock } as unknown as LivingReasoningService;
    const conversation = { appendMessage: jest.fn().mockResolvedValue({}) };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn().mockResolvedValue(undefined),
      finalizeTicketForSinistre: jest.fn(),
      finalizeTicketAsNonRecevable: jest.fn(),
    };
    const handoff = {
      dispatchSectorTechnician: jest.fn(),
      dispatchSocialReferral: jest.fn(),
      dispatchArtisanReferral: jest.fn(),
    };
    const pilot = new LiaJarvisPilotService(
      intake,
      handoff as never,
      { fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }) } as never,
      livingReasoning,
      conversation as never,
      ticketFinalizer as never,
    );

    const state = {
      ...intake.createInitialState(baseParams.title, baseParams.description),
      intakeMode: 'jarvis' as const,
      category: 'GENERIC' as const,
    };
    const result = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: "j'ai une trace de vert de gris au plafond dans la salle de bain",
      ticketId: 85,
    });

    // INV1 : pas de conclusion ni de transmission tant qu'on n'a pas sondé.
    expect(ticketFinalizer.finalizeTicketForBailleur).not.toHaveBeenCalled();
    expect(handoff.dispatchSectorTechnician).not.toHaveBeenCalled();
    expect(result.handoffTriggered).toBe(false);
    expect(result.autoConclusionApplied).toBe(true);
    expect(result.state.phase).toBe('AWAITING_PHOTO');
    expect(result.state.jarvisFacts?.awaiting_conclusion_photo).toBe('oui');
    expect(result.state.jarvisFacts?.pending_conclusion).toBe(
      'bailleur_responsable',
    );
    // INV2 : le message affiché est la parole de Grock (avec la demande de photo).
    expect(result.acknowledgment).toBe(grockAck);
  });

  it('bailleur 2e tour (déjà sondé) : conclusion + transmission (parole de Grock)', async () => {
    const grockAck = 'C’est confirmé, je transmets au technicien du bailleur.';
    runTurnMock = jest.fn().mockResolvedValue({
      state: intake.createInitialState(baseParams.title, baseParams.description),
      acknowledgment: grockAck,
      nextQuestion: null,
      fromLlm: true,
      grockState: 'bailleur_responsable' as GrockConversationState,
      handoffTriggered: true,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = { runTurn: runTurnMock } as unknown as LivingReasoningService;
    const conversation = { appendMessage: jest.fn().mockResolvedValue({}) };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn().mockResolvedValue(undefined),
      finalizeTicketForSinistre: jest.fn(),
      finalizeTicketAsNonRecevable: jest.fn(),
    };
    const pilot = new LiaJarvisPilotService(
      intake,
      {
        dispatchSectorTechnician: jest.fn(),
        dispatchSocialReferral: jest.fn(),
        dispatchArtisanReferral: jest.fn(),
      } as never,
      { fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }) } as never,
      livingReasoning,
      conversation as never,
      ticketFinalizer as never,
    );

    const state = {
      ...intake.createInitialState(baseParams.title, baseParams.description),
      intakeMode: 'jarvis' as const,
      category: 'GENERIC' as const,
      phase: 'AWAITING_PHOTO' as const,
      jarvisFacts: {
        awaiting_conclusion_photo: 'oui',
        pending_conclusion: 'bailleur_responsable',
      },
    };
    const result = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: 'voici la photo',
      ticketId: 86,
    });

    expect(ticketFinalizer.finalizeTicketForBailleur).toHaveBeenCalledTimes(1);
    expect(result.handoffTriggered).toBe(true);
    expect(result.acknowledgment).toBe(grockAck);
    expect(result.state.phase).toBe('DONE');
  });

  it('2e tour (déjà sondé) : Grock non terminal → conclusion forcée via pending_conclusion', async () => {
    // Après photo, Grock renvoie un état NON terminal (message quasi vide) :
    // le dossier doit tout de même conclure via l'état mémorisé au sondage.
    runTurnMock = jest.fn().mockResolvedValue({
      state: intake.createInitialState(baseParams.title, baseParams.description),
      acknowledgment: '',
      nextQuestion: null,
      fromLlm: true,
      grockState: 'ASK_ONE_QUESTION' as GrockConversationState,
      handoffTriggered: false,
    } satisfies Partial<JarvisPilotTurn>);

    const livingReasoning = { runTurn: runTurnMock } as unknown as LivingReasoningService;
    const conversation = { appendMessage: jest.fn().mockResolvedValue({}) };
    const ticketFinalizer = {
      finalizeTicketForBailleur: jest.fn().mockResolvedValue(undefined),
      finalizeTicketForSinistre: jest.fn(),
      finalizeTicketAsNonRecevable: jest.fn(),
    };
    const pilot = new LiaJarvisPilotService(
      intake,
      {
        dispatchSectorTechnician: jest.fn(),
        dispatchSocialReferral: jest.fn(),
        dispatchArtisanReferral: jest.fn(),
      } as never,
      { fromTicket: jest.fn().mockResolvedValue({ tenantSocial: null }) } as never,
      livingReasoning,
      conversation as never,
      ticketFinalizer as never,
    );

    const state = {
      ...intake.createInitialState(baseParams.title, baseParams.description),
      intakeMode: 'jarvis' as const,
      category: 'GENERIC' as const,
      phase: 'AWAITING_PHOTO' as const,
      jarvisFacts: {
        awaiting_conclusion_photo: 'oui',
        pending_conclusion: 'bailleur_responsable',
      },
    };
    const result = await pilot.runTenantTurn({
      ...baseParams,
      state,
      message: 'J’ai envoyé une photo.',
      ticketId: 87,
    });

    // Conclusion forcée : transmission bailleur + message posté (jamais « pas de retour »).
    expect(ticketFinalizer.finalizeTicketForBailleur).toHaveBeenCalledTimes(1);
    expect(result.autoConclusionApplied).toBe(true);
    expect(result.state.phase).toBe('DONE');
    expect(conversation.appendMessage).toHaveBeenCalledTimes(1);
    const posted = conversation.appendMessage.mock.calls[0][2] as string;
    expect(posted.length).toBeGreaterThan(0);
  });
});
