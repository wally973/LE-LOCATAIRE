/**
 * Purge physique N7 — NULL sur livingBuildingState / buildingState (Supabase).
 * Usage : npx ts-node -r tsconfig-paths/register scripts/purge-living-building-state.ts
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.ticket.updateMany({
      data: {
        livingBuildingState: Prisma.JsonNull,
        buildingState: Prisma.JsonNull,
      },
    });
    console.log(`[N7 PURGE] ${result.count} ticket(s) — LIVING_BUILDING_STATE effacé.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
