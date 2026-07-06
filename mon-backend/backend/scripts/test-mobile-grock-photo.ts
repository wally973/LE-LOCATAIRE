/**
 * Test E2E — même chemin que l'app mobile (HTTP) : ticket + message + upload + redo-photo.
 * Vérifie l'alignement capteurs ↔ parole sur la bulle LIA_HOST affichée au locataire.
 *
 * Prérequis : backend sur :3000, MISTRAL_API_KEY, seed demo.
 *
 * Usage :
 *   npx ts-node --transpile-only scripts/test-mobile-grock-photo.ts [chemin-photo.jpg]
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeCapteurParoleAlignment } from '../src/grock/learning/grock-capteur-parole-probe';
import {
  assertInfiltrationPlafondMobileParole,
  INFILTRATION_PLAFOND_MOBILE_REF,
  isInfiltrationPlafondMobileSignalement,
} from '../src/grock/fixtures/infiltration-plafond-mobile.fixture';
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

const DEFAULT_PHOTO = path.join(
  __dirname,
  '..',
  'uploads',
  '022fa35f-6bd1-4c1c-ab33-db2302a77083.jpg',
);

const TITLE =
  process.env.TEST_TITLE ?? INFILTRATION_PLAFOND_MOBILE_REF.title;
const DESCRIPTION =
  process.env.TEST_DESCRIPTION ?? INFILTRATION_PLAFOND_MOBILE_REF.description;
const TENANT_MESSAGE =
  process.env.TEST_MESSAGE ?? INFILTRATION_PLAFOND_MOBILE_REF.tenantMessage;
const PHOTO_FEEDBACK =
  process.env.TEST_PHOTO_FEEDBACK ?? INFILTRATION_PLAFOND_MOBILE_REF.photoFeedback;

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

async function assertBackendUp() {
  const probes = ['/landlords/public', '/api', '/'];
  for (const route of probes) {
    try {
      const res = await fetch(`${BASE_URL}${route}`, { signal: AbortSignal.timeout(8000) });
      if (res.status < 500) return;
    } catch {
      /* essai suivant */
    }
  }
  throw new Error(`Backend inaccessible sur ${BASE_URL} — lancez npm run start:dev`);
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

async function uploadPhoto(token: string, filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const base = path.basename(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), base);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = (await res.json()) as { url?: string };
  if (!res.ok || !data.url) {
    throw new Error(`Upload photo échoué (${res.status})`);
  }
  return data.url;
}

async function fetchTicketAndMessages(token: string, ticketId: number) {
  const [ticketRes, msgRes] = await Promise.all([
    request<JsonMap>('GET', `/tickets/${ticketId}`, token),
    request<JsonMap[]>('GET', `/tickets/${ticketId}/messages`, token),
  ]);
  return { ticket: ticketRes.data, messages: msgRes.data };
}

async function waitUntil(
  token: string,
  ticketId: number,
  label: string,
  predicate: (ticket: JsonMap, messages: JsonMap[]) => boolean,
): Promise<{ ticket: JsonMap; messages: JsonMap[] }> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const bundle = await fetchTicketAndMessages(token, ticketId);
    if (predicate(bundle.ticket, bundle.messages)) return bundle;
    const status = bundle.ticket.status as string;
    log('poll', `${label} — status=${status ?? '?'}`);
    await sleep(POLL_MS);
  }
  throw new Error(`Timeout en attendant : ${label}`);
}

async function main() {
  const photoPath = process.argv[2]?.trim() || DEFAULT_PHOTO;
  if (!fs.existsSync(photoPath)) {
    throw new Error(`Photo introuvable : ${photoPath}`);
  }

  console.log('=== Test mobile Grock + photo ===');
  console.log(`API   : ${BASE_URL}`);
  console.log(`Photo : ${photoPath}\n`);

  await assertBackendUp();

  const login = await request<{ access_token?: string }>('POST', '/auth/login', undefined, {
    email: EMAIL,
    password: PASSWORD,
  });
  const token = login.data.access_token;
  if (!token) throw new Error('Pas de token JWT');

  const me = await request<{ tenant?: { housingId?: number } }>('GET', '/tenant/me', token);
  const housingId = me.data.tenant?.housingId;
  if (!housingId) throw new Error('Pas de logement actif — lancez seed-lia-demo.ts');

  log('ticket', 'Création signalement (comme mobile)');
  const created = await request<JsonMap>('POST', '/tickets', token, {
    title: TITLE,
    description: DESCRIPTION,
    housingId,
    claimCategory: process.env.TEST_CLAIM_CATEGORY ?? 'PLUMBING',
  });
  const ticketId = created.data.id as number;
  log('ticket', `#${ticketId} — ${created.data.caseNumber ?? 'AFF-?'}`);

  log('étape 1', 'Attente accueil Lia (agent TICKET_OPENED)');
  const afterOpen = await waitUntil(
    token,
    ticketId,
    'accueil Lia',
    (_t, messages) => messages.some((m) => m.role === 'LIA_HOST'),
  );
  console.log(`  → Lia : ${lastHostMessage(afterOpen.messages).slice(0, 180)}…`);

  log('étape 2', 'Message locataire puis photo (upload + redo-photo)');
  await request('POST', `/tickets/${ticketId}/messages`, token, {
    content: TENANT_MESSAGE,
  });
  await sleep(POLL_MS);

  const photoUrl = await uploadPhoto(token, photoPath);
  log('photo', `Upload OK → ${photoUrl.slice(0, 80)}…`);

  await request('POST', `/tickets/${ticketId}/redo-photo`, token, {
    photoUrl,
    feedback: PHOTO_FEEDBACK,
  });

  log('étape 3', 'Attente fin analyse (plus LIA_ANALYZING)');
  const final = await waitUntil(
    token,
    ticketId,
    'analyse photo',
    (ticket) => ticket.status !== 'LIA_ANALYZING',
  );

  const hostSpeech = lastHostMessage(final.messages);
  const fil = readGrockFilFromTicket(final.ticket);
  const grockTurn = lastGrockAssistantTurn(fil);
  const ai = final.ticket.aiLastDecision as JsonMap | undefined;
  const grockBlock = ai?.grock as JsonMap | undefined;

  const state =
    (grockTurn?.state as string | undefined) ??
    (grockBlock?.state as string | undefined) ??
    null;
  const noteInterne =
    grockTurn?.note_interne ??
    (grockBlock?.note_interne as string | undefined) ??
    null;
  const thinking =
    grockTurn?.thinking ??
    (grockBlock?.thinking as string | undefined) ??
    null;
  const perception =
    (ai?.pipelineSteps as JsonMap[] | undefined)?.[0]?.extra &&
    typeof (ai?.pipelineSteps as JsonMap[])[0].extra === 'object'
      ? ((ai?.pipelineSteps as JsonMap[])[0].extra as JsonMap).visualPerception as string
      : null;

  console.log('\n--- RÉSULTAT MOBILE (bulle LIA_HOST) ---');
  console.log(hostSpeech || '(vide)');
  console.log('\n--- CAPTEURS Grock ---');
  console.log('state       :', state ?? '(inconnu)');
  console.log('note_interne:', (noteInterne ?? '(vide)').slice(0, 400));
  if (thinking) console.log('thinking    :', thinking.slice(0, 200), '…');

  const report = analyzeCapteurParoleAlignment({
    thinking,
    noteInterne,
    perception,
    state,
    tenantMessage: DESCRIPTION,
    acknowledgment: hostSpeech,
  });

  console.log('\n--- ALIGNEMENT capteurs ↔ parole ---');
  console.log(report.summary);
  if (report.stateSpeechGap) console.log('Écart état :', report.stateSpeechGap);
  if (report.missingInSpeech.length) {
    console.log('Manque dans la parole :', report.missingInSpeech.join(', '));
  }
  console.log('Couverture :', `${report.coveragePct} %`);

  const reformule = (noteInterne ?? '').includes('Sortie Grock reformulée');
  if (reformule) {
    console.error('\n[ÉCHEC] Signature réparation dégradante encore présente.');
    process.exit(1);
  }

  if (!hostSpeech.trim()) {
    console.error('\n[ÉCHEC] Aucune bulle Lia après photo.');
    process.exit(1);
  }

  const speechLower = hostSpeech.toLowerCase();
  const technicienSeul =
    /technicien/i.test(hostSpeech) &&
    !/assur|sinistre|s[eé]cur/i.test(hostSpeech);
  const noteMentionAssurance = /assur|sinistre/i.test(noteInterne ?? '');

  if (technicienSeul && noteMentionAssurance) {
    console.error('\n[ÉCHEC] Parole = technicien seul alors que capteurs voient assurance/sinistre.');
    process.exit(1);
  }

  if (state === 'sinistre') {
    const hasAssuranceSpeech = /assur|sinistre|5\s*jour|cinq\s*jour/i.test(speechLower);
    const hasSecuriteSpeech = /s[eé]cur|danger|urgence|ne touchez|eloign/i.test(speechLower);
    if (!hasAssuranceSpeech || !hasSecuriteSpeech) {
      console.error(
        '\n[ÉCHEC] État sinistre : la parole mobile doit mentionner assurance/sinistre ET sécurité.',
      );
      process.exit(1);
    }
  }

  if (isInfiltrationPlafondMobileSignalement(TITLE, DESCRIPTION)) {
    const refFailures = assertInfiltrationPlafondMobileParole(hostSpeech);
    if (refFailures.length) {
      console.error(
        `\n[ÉCHEC] REF_INFILTRATION_PLAFOND_MOBILE — manque : ${refFailures.join(', ')}`,
      );
      process.exit(1);
    }
  }

  const ok =
    report.missingInSpeech.length === 0 ||
    report.coveragePct >= 66 ||
    (state === 'sinistre' && /assur|sinistre/i.test(speechLower));

  if (!ok) {
    console.error('\n[ÉCHEC] Écart capteurs ↔ parole trop important.');
    process.exit(1);
  }

  console.log('\n=== SUCCÈS — mobile + photo OK ===');
  console.log(`Ticket #${ticketId} | status=${final.ticket.status} | resp=${final.ticket.responsibility}`);
}

main().catch((err) => {
  console.error('\n=== ÉCHEC ===');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
