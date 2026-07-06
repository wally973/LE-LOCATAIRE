/**
 * Test E2E mobile — ticket + message locataire (sans photo obligatoire).
 *
 * Usage :
 *   npx ts-node --transpile-only scripts/test-mobile-grock-message.ts
 */
import 'dotenv/config';
import { analyzeCapteurParoleAlignment } from '../src/grock/learning/grock-capteur-parole-probe';
import {
  GROCK_CONVERSATION_JARVIS_KEY,
  type GrockChatMessage,
} from '../src/grock/grock.service';

type JsonMap = Record<string, unknown>;

const BASE_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.TEST_TENANT_EMAIL ?? 'demo.locataire@lelocataire.test';
const PASSWORD = process.env.TEST_TENANT_PASSWORD ?? 'DemoLocataire1!';
const POLL_MS = Number(process.env.POLL_MS ?? 2500);
const MAX_WAIT_MS = Number(process.env.MAX_WAIT_MS ?? 300000);

const TITLE = process.env.TEST_TITLE ?? 'Fuite chauffe-eau solaire';
const DESCRIPTION =
  process.env.TEST_DESCRIPTION ??
  "Fuite sur le chauffe-eau solaire. Vanne fermée par le locataire. Demande d'intervention plombier.";
const TENANT_MESSAGE =
  process.env.TEST_MESSAGE ??
  "j'ai une fuite sur le chauffe eau solaire, j'ai fermer la vanne du chauffe eau pouvez-vous m'envoyer un plombier";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(step: string, detail?: string) {
  console.log(detail ? `[${step}] ${detail}` : `[${step}]`);
}

async function request<T = unknown>(
  method: string,
  route: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(`${method} ${route} → non JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${route} → HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return { status: res.status, data };
}

function lastHostMessage(messages: JsonMap[]): string {
  const hosts = messages.filter((m) => m.role === 'LIA_HOST');
  return (hosts[hosts.length - 1]?.content as string) ?? '';
}

function readGrockFilFromTicket(ticket: JsonMap): GrockChatMessage[] {
  const ai = ticket.aiLastDecision;
  if (!ai || typeof ai !== 'object') return [];
  const intake = (ai as JsonMap).intake;
  if (!intake || typeof intake !== 'object') return [];
  const facts = (intake as JsonMap).jarvisFacts;
  if (!facts || typeof facts !== 'object') return [];
  const raw = (facts as Record<string, string>)[GROCK_CONVERSATION_JARVIS_KEY];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as GrockChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function lastGrockAssistantTurn(fil: GrockChatMessage[]) {
  return [...fil].reverse().find((m) => m.role === 'assistant');
}

async function fetchTicketAndMessages(token: string, ticketId: number) {
  const [ticketRes, msgRes] = await Promise.all([
    request<JsonMap>('GET', `/tickets/${ticketId}`, token),
    request<JsonMap[]>('GET', `/tickets/${ticketId}/messages`, token),
  ]);
  return { ticket: ticketRes.data, messages: msgRes.data };
}

async function main() {
  console.log('=== Test mobile Grock (message locataire) ===');
  console.log(`API     : ${BASE_URL}`);
  console.log(`Titre   : ${TITLE}`);
  console.log(`Message : ${TENANT_MESSAGE}\n`);

  const login = await request<{ access_token?: string }>('POST', '/auth/login', undefined, {
    email: EMAIL,
    password: PASSWORD,
  });
  const token = login.data.access_token;
  if (!token) throw new Error('Pas de token JWT');

  const me = await request<{ tenant?: { housingId?: number } }>('GET', '/tenant/me', token);
  const housingId = me.data.tenant?.housingId;
  if (!housingId) throw new Error('Pas de logement actif');

  const created = await request<JsonMap>('POST', '/tickets', token, {
    title: TITLE,
    description: DESCRIPTION,
    housingId,
    claimCategory: 'PLUMBING',
  });
  const ticketId = created.data.id as number;
  log('ticket', `#${ticketId} — ${created.data.caseNumber ?? 'AFF-?'}`);

  const openingDeadline = Date.now() + MAX_WAIT_MS;
  let hostBefore = '';
  while (Date.now() < openingDeadline) {
    const { messages } = await fetchTicketAndMessages(token, ticketId);
    const host = lastHostMessage(messages);
    if (host) {
      hostBefore = host;
      log('accueil', host.slice(0, 200) + (host.length > 200 ? '…' : ''));
      break;
    }
    log('poll', 'accueil Lia…');
    await sleep(POLL_MS);
  }
  if (!hostBefore) throw new Error('Pas de message Lia à l’ouverture');

  log('locataire', `« ${TENANT_MESSAGE} »`);
  await request('POST', `/tickets/${ticketId}/messages`, token, {
    content: TENANT_MESSAGE,
  });

  const replyDeadline = Date.now() + MAX_WAIT_MS;
  let final = await fetchTicketAndMessages(token, ticketId);
  const hostCountBefore = final.messages.filter((m) => m.role === 'LIA_HOST').length;
  while (Date.now() < replyDeadline) {
    final = await fetchTicketAndMessages(token, ticketId);
    const hostCount = final.messages.filter((m) => m.role === 'LIA_HOST').length;
    const host = lastHostMessage(final.messages);
    if (hostCount > hostCountBefore && host !== hostBefore) break;
    if (hostCount > hostCountBefore && final.ticket.status !== 'LIA_ANALYZING') break;
    log('poll', `réponse Lia — status=${final.ticket.status}`);
    await sleep(POLL_MS);
  }

  const hostSpeech = lastHostMessage(final.messages);
  const grockTurn = lastGrockAssistantTurn(readGrockFilFromTicket(final.ticket));
  const state = grockTurn?.state ?? null;
  const noteInterne = grockTurn?.note_interne ?? null;
  const thinking = grockTurn?.thinking ?? null;

  console.log('\n--- RÉSULTAT MOBILE (bulle LIA_HOST) ---');
  console.log(hostSpeech || '(vide)');
  console.log('\n--- CAPTEURS Grock ---');
  console.log('state       :', state ?? '(inconnu)');
  console.log('resp ticket :', final.ticket.responsibility ?? '(?)');
  console.log('note_interne:', (noteInterne ?? '(vide)').slice(0, 400));
  if (thinking) console.log('thinking    :', thinking.slice(0, 220), '…');

  const report = analyzeCapteurParoleAlignment({
    thinking,
    noteInterne,
    state,
    tenantMessage: `${DESCRIPTION}\n${TENANT_MESSAGE}`,
    acknowledgment: hostSpeech,
  });

  console.log('\n--- ALIGNEMENT capteurs ↔ parole ---');
  console.log(report.summary);
  if (report.missingInSpeech.length) {
    console.log('Manque dans la parole :', report.missingInSpeech.join(', '));
  }
  console.log('Couverture :', `${report.coveragePct} %`);

  const allHostMessages = final.messages
    .filter((m) => m.role === 'LIA_HOST')
    .map((m) => String(m.content ?? ''));
  const prevHost = allHostMessages[allHostMessages.length - 2] ?? '';
  const duplicateBlock =
    allHostMessages.length >= 2 &&
    /transm|technicien|plombier/i.test(hostSpeech) &&
    /transm|technicien|plombier/i.test(prevHost) &&
    hostSpeech.length > 200 &&
    prevHost.length > 200 &&
    // enquête (?) puis transmission diagnostic = flux attendu, pas double pavé
    !(/\?/.test(prevHost) && /diagnostiqu|transm|va venir|acc[eè]s/i.test(hostSpeech));

  const checks: Array<{ ok: boolean; label: string }> = [
    {
      ok: /chauffe[\s-]?eau|solaire|fuite|eau/i.test(hostSpeech),
      label: 'parole évoque fuite / chauffe-eau',
    },
    {
      ok: hostSpeech.length <= 900,
      label: 'message mobile raisonnable (≤ ~900 car.)',
    },
    {
      ok: !/112|secours|quittez|sortez du logement|éloignez-vous du logement/i.test(hostSpeech),
      label: 'pas d’alarmisme type 112 / quitter le logement',
    },
    {
      ok:
        !/disjoncteur|étincell|odeur de br[ûu]l|courant au/i.test(hostSpeech) ||
        /eau.*(prise|ampoule|lumi)/i.test(`${DESCRIPTION} ${TENANT_MESSAGE}`),
      label: 'pas de dérive électrique sans symptôme',
    },
    {
      ok:
        /\?/.test(hostSpeech) ||
        /ballon|toiture|collecteur|intérieur|raccord|où/i.test(hostSpeech) ||
        /transm|technicien|plombier/i.test(hostSpeech),
      label: 'enquête (question origine) ou transmission',
    },
    {
      ok: !duplicateBlock,
      label: 'pas de double pavé répétitif technicien',
    },
    {
      ok: !(noteInterne ?? '').includes('Sortie Grock reformulée'),
      label: 'pas de réparation dégradante',
    },
  ];

  console.log('\n--- FIL LIA (toutes les bulles) ---');
  for (const [i, m] of allHostMessages.entries()) {
    console.log(`[${i + 1}] ${m.slice(0, 280)}${m.length > 280 ? '…' : ''}`);
  }

  console.log('\n--- COHÉRENCE métier chauffe-eau ---');
  let failed = false;
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} ${c.label}`);
    if (!c.ok) failed = true;
  }

  if (failed || !hostSpeech.trim()) {
    console.error('\n=== ÉCHEC — réponse incohérente ou vide ===');
    process.exit(1);
  }

  console.log('\n=== SUCCÈS — mobile chauffe-eau OK ===');
  console.log(`Ticket #${ticketId} | status=${final.ticket.status} | resp=${final.ticket.responsibility}`);
}

main().catch((err) => {
  console.error('\n=== ÉCHEC ===');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
