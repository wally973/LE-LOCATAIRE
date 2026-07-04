/**
 * Production mobile — passthrough Groq : signalement + AFPOL + fil. Aucun script dialogue.
 */
import { Injectable } from '@nestjs/common';
import type { LiaIntakeState } from '../intake/lia-intake.service';
import type { IntakePhase } from '../intake/lia-intake.service';
import type { JarvisPilotTurn } from '../intake/lia-jarvis-pilot.service';
import { normalizeCompanionLanguage } from '../../shared/lia-dialogue-languages';
import {
  GrockService,
  readGrockConversationFil,
  writeGrockConversationFil,
  type GrockChatMessage,
  type GrockConversationState,
} from '../../../grock/grock.service';
import { purgeJarvisCognitiveFacts } from './living-tabula-rasa';

function resolveIntakePhase(
  grockState: GrockConversationState | undefined,
  intakeComplete: boolean,
): IntakePhase {
  if (intakeComplete) return 'DONE';
  if (grockState === 'NEED_PHOTO') return 'AWAITING_PHOTO';
  return 'INTAKE';
}

@Injectable()
export class LivingReasoningService {
  constructor(private readonly grock: GrockService) {}

  async runTurn(params: {
    mode: 'opening' | 'tenant_turn';
    state: LiaIntakeState;
    title: string;
    description: string;
    message: string;
    tenantFirstName?: string;
    tenantSocial?: { displayName?: string } | null;
    ticketId?: number;
    wasAlreadyComplete?: boolean;
  }): Promise<JarvisPilotTurn> {
    const lang = normalizeCompanionLanguage(params.state.preferredLanguage);
    const displayName =
      params.tenantFirstName?.trim() ||
      params.tenantSocial?.displayName?.trim() ||
      'Marie';

    let state = params.state;
    if (params.mode === 'opening') {
      state = {
        ...state,
        jarvisFacts: purgeJarvisCognitiveFacts(state.jarvisFacts),
        answers: { ...(state.answers ?? {}), jarvis_intake_complete: 'non' },
      };
    }

    const signalementText = this.formatSignalementText(
      params.title,
      params.description,
    );
    const tenantUtterance = params.message.trim() || signalementText;

    let sessionFil: GrockChatMessage[] =
      params.mode === 'opening' ? [] : readGrockConversationFil(state.jarvisFacts);

    if (params.mode === 'opening' && tenantUtterance) {
      sessionFil = [
        {
          id: `tenant-opening-${Date.now()}`,
          role: 'user',
          text: tenantUtterance,
          createdAt: new Date(),
        },
      ];
    } else if (params.mode === 'tenant_turn' && params.message.trim()) {
      sessionFil = [
        ...sessionFil,
        {
          id: `tenant-${Date.now()}`,
          role: 'user',
          text: params.message.trim(),
          createdAt: new Date(),
        },
      ];
    }

    const grockTurn = await this.grock.runTurn({
      tenantFirstName: displayName,
      title: params.title,
      description: params.description,
      language: lang,
      ticketHistory: [],
      sessionMessages: sessionFil,
      tenantMessage: tenantUtterance,
      mode: params.mode,
    });

    sessionFil = [
      ...sessionFil,
      {
        id: `grock-${Date.now()}`,
        role: 'assistant',
        text: grockTurn.reply,
        thinking: grockTurn.thinking ?? undefined,
        state: grockTurn.state,
        next_action: grockTurn.nextAction,
        acknowledgment: grockTurn.acknowledgment,
        note_interne: grockTurn.noteInterne ?? undefined,
        createdAt: new Date(),
      },
    ];

    const intakeComplete = params.wasAlreadyComplete === true;
    const phase = resolveIntakePhase(grockTurn.state, intakeComplete);

    return {
      state: {
        ...state,
        phase,
        stepIndex: 0,
        preferredLanguage: lang,
        intakeMode: 'jarvis',
        answers: {
          ...state.answers,
          jarvis_intake_complete: intakeComplete ? 'oui' : 'non',
          jarvis_summary: grockTurn.reply.slice(0, 500),
          jarvis_last_ack: grockTurn.reply.slice(0, 500),
        },
        jarvisFacts: writeGrockConversationFil(state.jarvisFacts, sessionFil),
        skippedQuestionIds: [],
      },
      acknowledgment: grockTurn.reply,
      nextQuestion: null,
      fromLlm: grockTurn.fromLlm,
      handoffTriggered:
        params.mode === 'tenant_turn' &&
        (grockTurn.state === 'bailleur_responsable' ||
          grockTurn.state === 'sinistre'),
      grockState: grockTurn.state,
      grockNextAction: grockTurn.nextAction,
      grockNoteInterne: grockTurn.noteInterne,
    };
  }

  private formatSignalementText(title: string, description: string): string {
    const t = title.trim();
    const d = description.trim();
    if (!d) return t;
    if (!t || t === d) return d;
    const tBase = t.replace(/…$/u, '').trim();
    if (d.includes(tBase) && tBase.length > 10) return d;
    if (t.includes(d)) return t;
    return `${t}\n\n${d}`;
  }
}
