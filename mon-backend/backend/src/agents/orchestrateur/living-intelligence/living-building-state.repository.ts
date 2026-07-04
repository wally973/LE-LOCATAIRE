import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import type { LivingBuildingState } from './living-building-state.types';
import {
  parseLivingBuildingState,
  serializeLivingBuildingState,
} from './living-building-state.factory';
import {
  physicallyRecreateJarvisFacts,
  physicallyRecreateLivingState,
} from './living-state-instance';

export const LIVING_STATE_JARVIS_KEY = 'living_building_state_v1';

@Injectable()
export class LivingBuildingStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadForTicket(ticketId: number): Promise<LivingBuildingState | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { livingBuildingState: true, buildingState: true },
    });
    if (!ticket) return null;
    const parsed =
      parseLivingBuildingState(ticket.livingBuildingState) ??
      legacyBuildingToLiving(ticket.buildingState);
    return parsed;
  }

  async saveForTicket(ticketId: number, state: LivingBuildingState): Promise<void> {
    const json = JSON.parse(serializeLivingBuildingState(state)) as object;
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        livingBuildingState: json,
        buildingState: json,
        updatedAt: new Date(),
      },
    });
  }

  /** Destruction physique — NULL JSONB avant recréation (N7). */
  async physicallyDestroyForTicket(ticketId: number): Promise<void> {
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        livingBuildingState: Prisma.JsonNull,
        buildingState: Prisma.JsonNull,
        updatedAt: new Date(),
      },
    });
  }

  /** NULL puis nouvel état avec stateInstanceId unique. */
  async physicallyRecreateForTicket(
    ticketId: number,
    params: {
      title: string;
      description: string;
      language: CompanionLanguage;
      tenantFirstName?: string;
      ageBand?: 'senior' | 'adult' | 'young' | 'unknown';
    },
  ): Promise<LivingBuildingState> {
    await this.physicallyDestroyForTicket(ticketId);
    const state = physicallyRecreateLivingState({
      ...params,
      livesAlone: true,
      creolePreferred: params.language === 'gcf',
    });
    await this.saveForTicket(ticketId, state);
    return state;
  }
}

function legacyBuildingToLiving(raw: unknown): LivingBuildingState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.schema === 'LIVING_BUILDING_STATE') {
    return parseLivingBuildingState(o);
  }
  return null;
}

export function readLivingStateFromIntake(
  jarvisFacts: Record<string, string> | undefined,
): LivingBuildingState | null {
  const raw = jarvisFacts?.[LIVING_STATE_JARVIS_KEY];
  if (!raw) return null;
  try {
    return parseLivingBuildingState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLivingStateToIntake(
  jarvisFacts: Record<string, string> | undefined,
  state: LivingBuildingState,
): Record<string, string> {
  return physicallyRecreateJarvisFacts(jarvisFacts, state);
}
