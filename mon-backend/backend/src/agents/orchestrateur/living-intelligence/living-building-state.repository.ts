import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { LivingBuildingState } from './living-building-state.types';
import {
  parseLivingBuildingState,
  serializeLivingBuildingState,
} from './living-building-state.factory';

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
  return {
    ...(jarvisFacts ?? {}),
    [LIVING_STATE_JARVIS_KEY]: serializeLivingBuildingState(state),
    reasoning_source: 'living_intelligence',
  };
}
