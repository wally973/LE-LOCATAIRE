import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ticket = await prisma.ticket.findFirst({
    orderBy: { id: 'desc' },
    select: { aiLastDecision: true },
  });
  console.log(JSON.stringify(ticket?.aiLastDecision, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
