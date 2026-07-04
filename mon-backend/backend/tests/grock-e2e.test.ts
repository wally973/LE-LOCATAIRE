import assert from 'node:assert/strict';
import { AiRoutingService } from '../src/ai-routing/ai-routing.service';
import { LiaHostService } from '../src/agents/orchestrateur/conversation/lia-host.service';
import { GrockService, parseGrockJson } from '../src/grock/grock.service';
import { MistralOperator } from '../src/grock/port/mistral.operator';
import { SocialHousingGuyanePack } from '../src/grock/domain/social-housing-guyane.pack';
import { GROCK_SYSTEM_PROMPT } from '../src/grock/grock.prompt';

async function main() {
  if (!process.env.MISTRAL_API_KEY?.trim()) {
    throw new Error('MISTRAL_API_KEY obligatoire pour le test E2E Grock réel.');
  }

  const captured: {
    systemPrompt?: string;
    repairPrompt?: string;
    rawReply?: string;
  } = {};

  const host = new LiaHostService();
  const realChatMultiTurnMistral = host.chatMultiTurnMistral.bind(host);
  host.chatMultiTurnMistral = async (systemPrompt, turns, maxTokens, options) => {
    if (systemPrompt.startsWith(GROCK_SYSTEM_PROMPT)) {
      captured.systemPrompt = systemPrompt;
    } else {
      captured.repairPrompt = systemPrompt;
    }
    const result = await realChatMultiTurnMistral(
      systemPrompt,
      turns,
      maxTokens,
      options,
    );
    captured.rawReply = result?.text;
    return result;
  };

  const messages: Array<{ role: string; content: string; metadata?: unknown }> = [];
  const ticket = {
    id: 900001,
    title: 'Infiltration et ampoule',
    description:
      'Marie signale une infiltration dans la buanderie, avec une auréole proche du point lumineux et de la lumiere au plafond.',
    status: 'OPEN',
    responsibility: 'PENDING',
    aiAttempts: 0,
    aiMaxAttempts: 3,
    aiLastDecision: null,
    landlordProfileId: 1,
    housingId: 1,
    documents: [],
    tenant: {
      id: 1,
      userId: 10,
      firstName: 'Marie',
      user: { id: 10 },
    },
    housing: {
      id: 1,
      landlordId: 1,
      landlord: { user: { id: 20 } },
    },
  };

  const prisma = {
    tenantProfile: {
      findFirst: async () => ({ id: 1 }),
    },
    ticket: {
      findUnique: async () => ticket,
      findMany: async () => [],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(ticket, data);
        return ticket;
      },
      findUniqueOrThrow: async () => ticket,
    },
    ticketMessage: {
      findFirst: async () => messages.at(-1) ?? null,
      create: async ({ data }: { data: { role: string; content: string; metadata?: unknown } }) => {
        messages.push(data);
        return data;
      },
    },
    $executeRaw: async () => 1,
  };

  // Le noyau Grock parle au PORT IA ; on branche l'opérateur Mistral réel
  // (qui délègue au host instrumenté ci-dessus pour la capture du prompt).
  const operator = new MistralOperator(host);
  const grock = new GrockService(
    operator,
    new SocialHousingGuyanePack(),
    prisma as never,
  );
  const routing = new AiRoutingService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    grock,
  );

  await routing.analyzeTicket(ticket.id, {
    tenantFeedback:
      'Il y a une infiltration dans la buanderie et l’eau semble proche du point lumineux, de la lumiere et de l’ampoule.',
    force: true,
  });

  assert.ok(captured.systemPrompt?.startsWith(GROCK_SYSTEM_PROMPT));
  assert.match(captured.systemPrompt ?? '', /--- Domaine dominant \(non verrouillé\) ---/);
  assert.match(captured.systemPrompt ?? '', /ELECTRICITY/);
  assert.match(captured.systemPrompt ?? '', /HUMIDITY_ENVELOPE/);
  assert.match(captured.systemPrompt ?? '', /Perception visuelle/i);
  assert.match(captured.systemPrompt ?? '', /Pathologie/i);

  const grockDecision = ticket.aiLastDecision as unknown as {
    grock?: {
      state?: string;
      next_action?: string;
      acknowledgment?: string;
      note_interne?: string;
    };
  };
  const parsed = parseGrockJson(captured.rawReply ?? '') ?? {
    thinking: null,
    state: grockDecision.grock?.state ?? null,
    next_action: grockDecision.grock?.next_action ?? null,
    acknowledgment: grockDecision.grock?.acknowledgment ?? null,
    note_interne: grockDecision.grock?.note_interne ?? null,
  };
  assert.ok(parsed, 'Grock doit répondre en JSON strict.');
  assert.ok(parsed.note_interne, 'note_interne doit être présent.');
  assert.ok(parsed.acknowledgment, 'acknowledgment doit être présent.');
  assert.ok(parsed.state, 'state doit être présent.');
  assert.ok(parsed.next_action, 'next_action doit être présent.');
  assert.doesNotMatch(parsed.acknowledgment ?? '', /thinking|note_interne|\{|\}/i);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, parsed.acknowledgment);
  assert.equal((messages[0].metadata as { route?: string }).route, 'grock');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
