import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ticket = await prisma.ticket.findFirst({
    orderBy: { id: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      tenant: { select: { firstName: true, dossierNumber: true } },
    },
  });
  if (!ticket) {
    console.log('Aucun ticket en base.');
    return;
  }
  const ai = ticket.aiLastDecision as Record<string, unknown> | null;
  console.log(
    JSON.stringify(
      {
        id: ticket.id,
        caseNumber: ticket.caseNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        responsibility: ticket.responsibility,
        createdAt: ticket.createdAt,
        tenant: ticket.tenant,
        intakePhase: (ai?.intake as { phase?: string })?.phase,
        intakeMode: (ai?.intake as { intakeMode?: string })?.intakeMode,
        preferredLanguage: (ai?.intake as { preferredLanguage?: string })
          ?.preferredLanguage,
        jarvisFacts: (ai?.intake as { jarvisFacts?: Record<string, string> })
          ?.jarvisFacts,
        completedGoals: (ai?.agent as { completedGoals?: string[] })
          ?.completedGoals,
        messageForTenant: ai?.messageForTenant,
        responsibilityFromAi: ai?.responsibility,
        messages: ticket.messages.map((m) => ({
          role: m.role,
          content: m.content,
          metadata: m.metadata,
          createdAt: m.createdAt,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
