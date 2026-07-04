/**
 * Test réel Lia-Lab — mêmes endpoints HTTP que l'UI (login → session → message → photo).
 * Usage : npx ts-node --transpile-only scripts/real-lia-lab-photo-http.ts [chemin-image]
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = process.env.LIA_LAB_TEST_BASE ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'ewaldgoodman@gmail.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe_Admin!';

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login échoué HTTP ${res.status} — vérifiez SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Pas de access_token dans la réponse login');
  return data.access_token;
}

async function main(): Promise<void> {
  const defaultImage = join(
    __dirname,
    '..',
    'uploads',
    '022fa35f-6bd1-4c1c-ab33-db2302a77083.jpg',
  );
  const imagePath = process.argv[2]?.trim() || defaultImage;
  if (!existsSync(imagePath)) {
    console.error('[fail] Image introuvable :', imagePath);
    process.exitCode = 1;
    return;
  }

  console.log('[1/4] Login ADMIN…');
  const token = await login();
  const auth = { Authorization: `Bearer ${token}` };

  console.log('[2/4] Démarrage session Grock…');
  const startRes = await fetch(`${BASE}/lia-lab/sessions/start`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Fuite buanderie',
      description: "Fuite d'eau dans la buanderie.",
      tenantFirstName: 'Marie',
      language: 'fr',
    }),
  });
  if (!startRes.ok) {
    throw new Error(`start HTTP ${startRes.status}: ${await startRes.text()}`);
  }
  const session = (await startRes.json()) as {
    sessionId: string;
    messages: Array<{ role: string; text: string }>;
  };
  console.log('[ok] session', session.sessionId);
  console.log('[ok] Grock:', session.messages[0]?.text?.slice(0, 120));

  console.log('[3/4] Message Marie…');
  const msgRes = await fetch(`${BASE}/lia-lab/sessions/${session.sessionId}/message`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: "J'ai de l'eau dans ma buanderie, je vous envoie une photo." }),
  });
  if (!msgRes.ok) throw new Error(`message HTTP ${msgRes.status}`);

  console.log('[4/4] Upload photo (multipart, comme l\'UI)…');
  const buffer = readFileSync(imagePath);
  const form = new FormData();
  form.append('photo', new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' }), 'photo.jpg');
  form.append('caption', 'Voici la buanderie.');

  const photoRes = await fetch(`${BASE}/lia-lab/sessions/${session.sessionId}/photo`, {
    method: 'POST',
    headers: auth,
    body: form,
  });
  if (!photoRes.ok) {
    throw new Error(`photo HTTP ${photoRes.status}: ${await photoRes.text()}`);
  }

  const view = (await photoRes.json()) as {
    visualPerception: string | null;
    visionModel: string | null;
    messages: Array<{ role: string; text: string; imagePreview?: string }>;
  };

  console.log('\n========== [Perception Visuelle Brute] ==========');
  if (view.visualPerception) {
    console.log(view.visualPerception);
    console.log('\nModèle vision:', view.visionModel);
  } else {
    console.warn('[WARN] Perception vide');
    process.exitCode = 1;
  }

  const grock = [...view.messages].reverse().find((m) => m.role === 'grock');
  const tenantPhoto = [...view.messages].reverse().find((m) => m.imagePreview);
  console.log('\n========== Réponse Grock ==========');
  console.log(grock?.text ?? '(vide)');
  console.log('\nPhoto reçue:', tenantPhoto?.imagePreview ? 'oui (data-URL dans réponse)' : 'non');
  console.log('\n[ok] Test réel HTTP terminé — ouvrez http://localhost:5173/admin/lia-lab pour la même session visuellement.');
  console.log('Session ID (mémoire serveur):', session.sessionId);
}

void main().catch((e) => {
  console.error('[fail]', (e as Error).message);
  process.exitCode = 1;
});
