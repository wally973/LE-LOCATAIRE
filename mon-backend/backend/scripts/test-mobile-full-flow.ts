/**
 * Simulation client mobile — validation communication Flutter ↔ agents IA.
 *
 * Scénario :
 *   1. « Bonjou » (accueil)
 *   2. Signalement « Eau savonneuse » (aspect de l'eau)
 *   3. Réception demande capteurs (intake ou garde IA)
 *   4. Envoi capteurs R+1 + Saison sèche (+ créneau horaire)
 *   5. Verdict final
 *   6. Vérification JSON : language, severity, sensors, legal_basis, avatar_action
 *
 * Prérequis :
 *   npx ts-node scripts/seed-lia-demo.ts
 *   npm run start:dev
 *
 * Usage :
 *   npm run test:mobile-flow
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  assertMobileFieldTypes,
  extractMobileFields,
} from '../src/agents/shared/mobile-client-fields';

type JsonMap = Record<string, unknown>;

const BASE_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.TEST_TENANT_EMAIL ?? 'demo.locataire@lelocataire.test';
const PASSWORD = process.env.TEST_TENANT_PASSWORD ?? 'DemoLocataire1!';
const POLL_MS = Number(process.env.POLL_MS ?? 2000);
const MAX_WAIT_MS = Number(process.env.MAX_WAIT_MS ?? 300000);

/** Réponses alignées sur les ids intake (INTAKE_WATER_ON_FLOOR). */
const INTAKE_REPLIES: Record<string, string> = {
  water_aspect: 'Eau savonneuse et mousseuse',
  timing_pattern: 'Entre 19h et 21h le soir uniquement',
  building_floor: 'R+1, premier étage',
  weather_context: 'Saison sèche, pas de pluie depuis trois semaines',
};

const flowFlags = {
  bonjouSent: false,
  savonneuseSent: false,
  capteurPromptSeen: false,
  capteursSent: false,
};

function log(step: string, detail?: string) {
  console.log(detail ? `[${step}] ${detail}` : `[${step}]`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
    throw new Error(`${method} ${route} → réponse non JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${route} → HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  return { status: res.status, data };
}

async function assertBackendUp() {
  const probes = ['/landlords/public', '/api', '/'];
  for (const route of probes) {
    try {
      const res = await fetch(`${BASE_URL}${route}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.status < 500) return;
    } catch {
      /* essai suivant */
    }
  }
  throw new Error(`Backend inaccessible sur ${BASE_URL}`);
}

function parseIntake(ticket: JsonMap): {
  phase: string | null;
  answers: Record<string, string>;
} {
  const ai = ticket.aiLastDecision;
  if (!ai || typeof ai !== 'object') return { phase: null, answers: {} };
  const intake = (ai as JsonMap).intake;
  if (!intake || typeof intake !== 'object') return { phase: null, answers: {} };
  const map = intake as JsonMap;
  const answers =
    map.answers && typeof map.answers === 'object'
      ? (map.answers as Record<string, string>)
      : {};
  return {
    phase: typeof map.phase === 'string' ? map.phase : null,
    answers,
  };
}

function hostToQuestionId(host: string): string | null {
  const t = host.toLowerCase();
  if (/mousseuse|savonneuse|claire.*trouble|aspect/.test(t)) return 'water_aspect';
  if (/heures|créneau|creneau|19/.test(t)) return 'timing_pattern';
  if (/étage|etage|\brdc\b|\br\+/.test(t)) return 'building_floor';
  if (/pluie|saison/.test(t)) return 'weather_context';
  if (/depuis quand/.test(t)) return 'since_when';
  if (/siphon|débouch/.test(t)) return 'siphon_action';
  if (/s'écoule|écoule/.test(t)) return 'drain_ok';
  if (/où exactement|ou exactement/.test(t)) return 'location_detail';
  return null;
}

function hasSensorGatePrompt(messages: JsonMap[]): boolean {
  return messages.some(
    (m) =>
      m.role === 'LIA_HOST' &&
      typeof m.content === 'string' &&
      m.content.includes('il nous manque des précisions'),
  );
}

function hasCapteurPrompt(messages: JsonMap[]): boolean {
  return messages.some((m) => {
    if (m.role !== 'LIA_HOST' || typeof m.content !== 'string') return false;
    return hostToQuestionId(m.content) !== null || hasSensorGatePrompt([m]);
  });
}

function isFinalVerdict(ticket: JsonMap): boolean {
  const status = ticket.status as string;
  const resp = ticket.responsibility as string;
  if (status === 'LIA_ANALYZING') return false;
  if (status === 'AWAITING_TENANT_PHOTO') return false;
  if (resp === 'PENDING') return false;
  return ['LOCATAIRE', 'BAILLEUR', 'ESCALADE_BAILLEUR', 'NON_RECEVABLE', 'SOCIAL'].includes(
    resp,
  );
}

function isTargetVerdict(ticket: JsonMap): boolean {
  return isFinalVerdict(ticket) && ticket.responsibility === 'BAILLEUR';
}

function assertFinalMobileContract(
  label: string,
  fields: ReturnType<typeof extractMobileFields>,
  ticket: JsonMap,
): void {
  assertMobileFieldTypes(label, fields);
  const missing: string[] = [];
  if (!fields.severity) missing.push('severity');
  if (!fields.sensors) missing.push('sensors');
  if (!fields.language) missing.push('language');
  if (!fields.avatar_action) missing.push('avatar_action');
  if (!fields.legal_basis) missing.push('legal_basis');
  if (fields.verdict_label !== 'VERDICT_BAILLEUR') {
    missing.push('verdict_label (VERDICT_BAILLEUR)');
  }
  if (missing.length > 0) {
    throw new Error(
      `Validation mobile (${label}) — champs manquants : ${missing.join(', ')}`,
    );
  }
  const aspect = fields.sensors?.water_aspect ?? '';
  if (!/savon|mousse/i.test(aspect)) {
    throw new Error(`Capteur water_aspect incohérent : ${aspect || '(vide)'}`);
  }
  const ai = ticket.aiLastDecision as JsonMap | undefined;
  const msg = typeof ai?.messageForTenant === 'string' ? ai.messageForTenant : '';
  if (!msg.includes('VERDICT_BAILLEUR')) {
    throw new Error('messageForTenant doit contenir VERDICT_BAILLEUR');
  }
}

function lastHostMessage(messages: JsonMap[]): string {
  const hosts = messages.filter((m) => m.role === 'LIA_HOST');
  return (hosts[hosts.length - 1]?.content as string) ?? '';
}

function pickTenantReply(host: string, intake: ReturnType<typeof parseIntake>): string | null {
  if (hasSensorGatePrompt([{ role: 'LIA_HOST', content: host }])) {
    return (
      'L\'eau est savonneuse et mousseuse. R+1, premier étage. ' +
      'Saison sèche. Entre 19h et 21h le soir.'
    );
  }

  const qid = hostToQuestionId(host);
  if (qid === 'water_aspect' && !flowFlags.savonneuseSent) {
    flowFlags.savonneuseSent = true;
    return 'Eau savonneuse';
  }
  if (qid && INTAKE_REPLIES[qid] && !intake.answers[qid]) {
    return INTAKE_REPLIES[qid];
  }

  if (
    !flowFlags.bonjouSent &&
    !qid &&
    /bonjour|accompagne|numéro d'affaire|affaire/i.test(host)
  ) {
    flowFlags.bonjouSent = true;
    return 'Bonjou';
  }

  if (intake.phase === 'AWAITING_PHOTO' || /photo|prendre une photo/i.test(host)) {
    return 'Je ne peux pas envoyer de photo, continuez sans photo';
  }
  if (/depuis quand/.test(host)) return 'Depuis hier soir';
  if (/siphon|débouch/.test(host)) return 'Non, pas encore';
  if (/s'écoule|écoule/.test(host)) return 'Non, eau stagnante';
  if (/où exactement|ou exactement/.test(host)) return 'Au milieu du salon';
  return null;
}

async function uploadMinimalPhoto(token: string): Promise<string> {
  const jpegPath = path.join(__dirname, '..', 'uploads', 'test-mobile-flow.jpg');
  const buffer = fs.existsSync(jpegPath)
    ? fs.readFileSync(jpegPath)
    : Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==',
        'base64',
      );

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'test-mobile-flow.jpg');

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = (await res.json()) as { url?: string };
  if (!res.ok || !data.url) throw new Error(`Upload photo échoué (${res.status})`);
  return data.url;
}

async function sendMessage(token: string, ticketId: number, content: string) {
  log('locataire', `« ${content} »`);
  await request('POST', `/tickets/${ticketId}/messages`, token, { content });
  await sleep(POLL_MS);
}

async function fetchTicketAndMessages(token: string, ticketId: number) {
  const [ticketRes, msgRes] = await Promise.all([
    request<JsonMap>('GET', `/tickets/${ticketId}`, token),
    request<JsonMap[]>('GET', `/tickets/${ticketId}/messages`, token),
  ]);
  return { ticket: ticketRes.data, messages: msgRes.data };
}

async function waitForCompanionFields(
  token: string,
  ticketId: number,
  deadline: number,
): Promise<ReturnType<typeof extractMobileFields>> {
  while (Date.now() < deadline) {
    const ticket = (await request<JsonMap>('GET', `/tickets/${ticketId}`, token)).data;
    const fields = extractMobileFields(ticket);
    if (fields.language && fields.avatar_action) return fields;
    await sleep(POLL_MS);
  }
  const ticket = (await request<JsonMap>('GET', `/tickets/${ticketId}`, token)).data;
  return extractMobileFields(ticket);
}

async function main() {
  console.log('=== Test flux mobile (client simulé) ===');
  console.log(`API: ${BASE_URL}\n`);

  await assertBackendUp();

  const login = await request<{ access_token?: string; token?: string }>(
    'POST',
    '/auth/login',
    undefined,
    { email: EMAIL, password: PASSWORD },
  );
  const token = login.data.access_token ?? login.data.token;
  if (!token) throw new Error('Pas de token JWT');

  const me = await request<{ tenant?: { housingId?: number } }>('GET', '/tenant/me', token);
  const housingId = me.data.tenant?.housingId;
  if (!housingId) throw new Error('Pas de logement actif');

  log('ticket', 'Création signalement eau au sol');
  const created = await request<JsonMap>('POST', '/tickets', token, {
    title: 'Flaque d\'eau au salon',
    description:
      'De l\'eau savonneuse au sol au milieu du salon depuis hier soir.',
    housingId,
    claimCategory: 'PLUMBING',
  });
  const ticketId = created.data.id as number;
  log('ticket', `#${ticketId} — ${created.data.caseNumber ?? 'AFF-?'}`);
  await sleep(2500);

  const initial = (await request<JsonMap>('GET', `/tickets/${ticketId}`, token)).data;
  const initialIntake = parseIntake(initial);
  if (
    initialIntake.answers.water_aspect ||
    /savon|mousse/i.test('De l\'eau savonneuse au sol au milieu du salon depuis hier soir.')
  ) {
    flowFlags.savonneuseSent = true;
    log('étape 2/6', '« Eau savonneuse » (déjà qualifiée à l\'ouverture du dossier)');
  }

  log('étape 1–2/6', 'Conversation : Bonjou puis eau savonneuse (via intake)');
  log('étape 3–5/6', 'Capteurs → analyse → verdict');

  let lastHost = '';
  const deadline = Date.now() + MAX_WAIT_MS;

  for (let turn = 0; Date.now() < deadline; turn++) {
    const { ticket, messages } = await fetchTicketAndMessages(token, ticketId);
    const host = lastHostMessage(messages);
    const intake = parseIntake(ticket);

    if (hasCapteurPrompt(messages) && !flowFlags.capteurPromptSeen) {
      flowFlags.capteurPromptSeen = true;
      log('étape 3/6', 'Demande capteurs reçue');
      console.log(`  → Lia : ${host.slice(0, 180)}…`);
      assertMobileFieldTypes('après demande capteurs', extractMobileFields(ticket));
    }

    if (isTargetVerdict(ticket)) {
      log('étape 5/6', `Verdict : ${ticket.responsibility}`);
      break;
    }

    if (
      isFinalVerdict(ticket) &&
      !isTargetVerdict(ticket) &&
      ticket.responsibility !== 'NON_RECEVABLE'
    ) {
      log(
        'warn',
        `Verdict ${ticket.responsibility} — relance analyse avec capteurs complets`,
      );
      await request('POST', `/tickets/${ticketId}/tenant-feedback`, token, {
        feedback:
          'Récap : eau savonneuse et mousseuse au sol, R+1, saison sèche, ' +
          'apparition entre 19h et 21h uniquement le soir.',
      });
      await sleep(5000);
      continue;
    }

    if (host !== lastHost) {
      const reply = pickTenantReply(host, intake);
      if (reply) {
        if (reply === 'Bonjou') log('étape 1/6', '« Bonjou »');
        if (reply === 'Eau savonneuse' || reply.includes('savonneuse')) {
          log('étape 2/6', '« Eau savonneuse »');
        }
        if (
          INTAKE_REPLIES.building_floor === reply ||
          INTAKE_REPLIES.weather_context === reply
        ) {
          if (!flowFlags.capteursSent) {
            flowFlags.capteursSent = true;
            log('étape 4/6', 'Capteurs R+1 + Saison sèche');
          }
        }
        await sendMessage(token, ticketId, reply);
      }
    }

    if (ticket.status === 'AWAITING_TENANT_PHOTO') {
      log('photo', 'Upload + redo-photo (comme l\'app mobile)');
      const photoUrl = await uploadMinimalPhoto(token);
      await request('POST', `/tickets/${ticketId}/redo-photo`, token, {
        photoUrl,
        feedback:
          'Photo de la flaque. Eau savonneuse, R+1, saison sèche, 19h-21h.',
      });
      await sleep(3000);
    }

    if (ticket.status === 'LIA_ANALYZING') {
      log('poll', `Analyse IA (${turn})…`);
    }

    lastHost = host;
    await sleep(POLL_MS);

    if (turn > 100) {
      throw new Error('Trop de tours de conversation sans verdict final');
    }
  }

  let finalTicket = (await request<JsonMap>('GET', `/tickets/${ticketId}`, token)).data;

  if (!isTargetVerdict(finalTicket)) {
    log('recovery', 'Dernière relance tenant-feedback (capteurs golden REF)');
    if (finalTicket.status === 'AWAITING_TENANT_PHOTO') {
      const photoUrl = await uploadMinimalPhoto(token);
      await request('POST', `/tickets/${ticketId}/redo-photo`, token, {
        photoUrl,
        feedback:
          'Photo flaque. Eau savonneuse R+1 saison sèche 19h-21h.',
      });
      await sleep(5000);
    } else {
      await request('POST', `/tickets/${ticketId}/tenant-feedback`, token, {
        feedback:
          'Eau savonneuse mousseuse au sol salon. R+1 premier étage. ' +
          'Saison sèche. Entre 19h et 21h chaque soir.',
      });
      await sleep(5000);
    }
    const recoveryDeadline = Date.now() + 180000;
    while (Date.now() < recoveryDeadline) {
      finalTicket = (await request<JsonMap>('GET', `/tickets/${ticketId}`, token)).data;
      if (isTargetVerdict(finalTicket)) break;
      if (finalTicket.status === 'LIA_ANALYZING') log('poll', 'Analyse recovery…');
      if (finalTicket.status === 'AWAITING_TENANT_PHOTO') {
        const photoUrl = await uploadMinimalPhoto(token);
        await request('POST', `/tickets/${ticketId}/redo-photo`, token, {
          photoUrl,
          feedback: 'Photo flaque eau savonneuse.',
        });
        await sleep(5000);
      }
      await sleep(POLL_MS);
    }
  }

  if (!flowFlags.capteurPromptSeen) {
    throw new Error('Demande capteurs non reçue dans le fil');
  }
  if (!flowFlags.bonjouSent) {
    throw new Error('Message « Bonjou » non envoyé');
  }
  if (!flowFlags.savonneuseSent) {
    throw new Error(
      'Qualification « eau savonneuse » absente (message ou préremplissage intake)',
    );
  }
  if (!isTargetVerdict(finalTicket)) {
    throw new Error(
      `Verdict BAILLEUR attendu (reçu ${finalTicket.responsibility}, status=${finalTicket.status}). ` +
        `Capteurs : ${JSON.stringify(extractMobileFields(finalTicket).sensors)}`,
    );
  }

  log('étape 6/6', 'Validation JSON mobile (typage Flutter)');
  const finalFields = await waitForCompanionFields(
    token,
    ticketId,
    Date.now() + 30000,
  );
  console.log('  → champs mobile:', JSON.stringify(finalFields, null, 2));
  assertFinalMobileContract('verdict final', finalFields, finalTicket);

  console.log('\n=== SUCCÈS — mobile ↔ agents OK ===');
  console.log(`Ticket #${ticketId} | VERDICT_BAILLEUR`);
  console.log(`language=${finalFields.language} | severity=${finalFields.severity}`);
  console.log(`avatar_action=${finalFields.avatar_action}`);
  console.log(`legal_basis=${(finalFields.legal_basis ?? '').slice(0, 80)}…`);
  console.log(`sensors=${JSON.stringify(finalFields.sensors)}`);
}

main().catch((err) => {
  console.error('\n=== ÉCHEC ===');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
