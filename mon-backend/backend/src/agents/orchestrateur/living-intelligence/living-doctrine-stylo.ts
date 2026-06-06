/**
 * Stylo des agents — capture de sagesse dans knowledge/doctrine/.
 * Phase C : JARVIS_DOCTRINE_LEDGER + fichiers .md — Loi signée injectée en délibération.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  listLedgerLessons,
  removeLedgerEntry,
  upsertLedgerEntry,
} from './living-doctrine-ledger';

export type DoctrineAuthor = 'enqueteur' | 'archiviste' | 'majordome' | 'architecte';
export type DoctrineLessonStatus = 'PENDING_ADMIN_SIGNATURE' | 'SIGNED';

export interface DoctrineLesson {
  id: string;
  author: DoctrineAuthor;
  title: string;
  body: string;
  createdAt: string;
  status: DoctrineLessonStatus;
  sessionRef?: string;
  filePath: string;
  signedAt?: string | null;
  signedBy?: string | null;
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/** Chemin canonique knowledge/doctrine/ (depuis racine repo ou cwd backend). */
export function resolveDoctrineDirectory(): string {
  const candidates = [
    path.join(process.cwd(), 'knowledge', 'doctrine'),
    path.join(process.cwd(), '..', '..', 'knowledge', 'doctrine'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'knowledge', 'doctrine'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  const fallback = candidates[0];
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function parseLessonFile(filePath: string): DoctrineLesson | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!fm) return null;
    const meta = fm[1];
    const body = fm[2].trim();
    const author = (meta.match(/^author:\s*(.+)$/m)?.[1]?.trim() ??
      'architecte') as DoctrineAuthor;
    const title = meta.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? path.basename(filePath);
    const createdAt =
      meta.match(/^createdAt:\s*(.+)$/m)?.[1]?.trim() ?? new Date().toISOString();
    const sessionRef = meta.match(/^sessionRef:\s*(.+)$/m)?.[1]?.trim();
    const statusRaw = meta.match(/^status:\s*(.+)$/m)?.[1]?.trim();
    const status: DoctrineLessonStatus =
      statusRaw === 'SIGNED' ? 'SIGNED' : 'PENDING_ADMIN_SIGNATURE';
    const signedAt = meta.match(/^signedAt:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const signedBy = meta.match(/^signedBy:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const id = path.basename(filePath, '.md');
    return {
      id,
      author,
      title,
      body,
      createdAt,
      status,
      sessionRef,
      filePath,
      signedAt,
      signedBy,
    };
  } catch {
    return null;
  }
}

/** Charge les leçons signées pour la bibliothèque agents (Loi uniquement). */
export function loadDoctrineBibliotheque(limit = 12): Array<{
  id: string;
  author: DoctrineAuthor;
  title: string;
  body: string;
  createdAt: string;
}> {
  const signed = loadSignedDoctrineForDeliberation(limit);
  return signed.map(({ id, author, title, body, createdAt }) => ({
    id,
    author,
    title,
    body,
    createdAt,
  }));
}

/** Leçons en attente de signature Architecte (cockpit). */
export function listPendingDoctrineLessons(limit = 20): DoctrineLesson[] {
  const ledgerPending = listLedgerLessons({
    status: 'PENDING_ADMIN_SIGNATURE',
    limit,
  });
  if (ledgerPending.length > 0) {
    return ledgerPending.map((l) => ({
      id: l.id,
      author: l.author,
      title: l.title,
      body: l.body,
      createdAt: l.createdAt,
      status: l.status,
      sessionRef: l.sessionRef,
      filePath: l.filePath,
      signedAt: l.signedAt ?? null,
      signedBy: l.signedBy ?? null,
    }));
  }

  const dir = resolveDoctrineDirectory();
  const out: DoctrineLesson[] = [];
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort()
      .reverse();
    for (const file of files) {
      if (out.length >= limit) break;
      const lesson = parseLessonFile(path.join(dir, file));
      if (lesson?.status === 'PENDING_ADMIN_SIGNATURE') out.push(lesson);
    }
  } catch {
    return [];
  }
  return out;
}

/** Le Stylo — écrit une leçon (interceptée par le Gardien → PENDING). */
export function appendDoctrineLesson(params: {
  author: DoctrineAuthor;
  title: string;
  body: string;
  sessionRef?: string;
  status?: DoctrineLessonStatus;
}): DoctrineLesson {
  const dir = resolveDoctrineDirectory();
  const title = params.title.trim() || 'Leçon sans titre';
  const body = params.body.trim();
  if (!body) {
    throw new Error('Stylo — corps de leçon vide');
  }

  const status =
    params.status ??
    (params.author === 'architecte' ? 'SIGNED' : 'PENDING_ADMIN_SIGNATURE');

  const createdAt = new Date().toISOString();
  const day = createdAt.slice(0, 10);
  const base = `${day}-${slugify(title)}`;
  let fileName = `${base}.md`;
  let n = 1;
  while (fs.existsSync(path.join(dir, fileName))) {
    n += 1;
    fileName = `${base}-${n}.md`;
  }

  const filePath = path.join(dir, fileName);
  const frontMatter = [
    '---',
    `author: ${params.author}`,
    `createdAt: ${createdAt}`,
    `status: ${status}`,
    status === 'SIGNED' ? `signedAt: ${createdAt}` : 'signedAt:',
    status === 'SIGNED' ? 'signedBy: architecte' : 'signedBy:',
    params.sessionRef ? `sessionRef: ${params.sessionRef}` : '',
    `title: ${title}`,
    '---',
    '',
    body,
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(filePath, frontMatter, 'utf8');

  const lesson: DoctrineLesson = {
    id: path.basename(fileName, '.md'),
    author: params.author,
    title,
    body,
    createdAt,
    status,
    sessionRef: params.sessionRef,
    filePath,
    signedAt: status === 'SIGNED' ? createdAt : null,
    signedBy: status === 'SIGNED' ? 'architecte' : null,
  };
  upsertLedgerEntry(lesson);
  return lesson;
}

/** Signature Architecte — la leçon devient Loi dans la bibliothèque. */
export function signDoctrineLesson(lessonId: string, signedBy = 'architecte'): DoctrineLesson | null {
  const dir = resolveDoctrineDirectory();
  const filePath = path.join(dir, `${lessonId}.md`);
  if (!fs.existsSync(filePath)) return null;
  const lesson = parseLessonFile(filePath);
  if (!lesson) return null;

  const signedAt = new Date().toISOString();
  const frontMatter = [
    '---',
    `author: ${lesson.author}`,
    `createdAt: ${lesson.createdAt}`,
    'status: SIGNED',
    `signedAt: ${signedAt}`,
    `signedBy: ${signedBy}`,
    lesson.sessionRef ? `sessionRef: ${lesson.sessionRef}` : '',
    `title: ${lesson.title}`,
    '---',
    '',
    lesson.body,
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(filePath, frontMatter, 'utf8');
  const signed = parseLessonFile(filePath);
  if (signed) upsertLedgerEntry(signed);
  return signed;
}

/** Rejet Architecte — supprime la leçon et l'entrée ledger. */
export function rejectDoctrineLesson(lessonId: string): boolean {
  const dir = resolveDoctrineDirectory();
  const filePath = path.join(dir, `${lessonId}.md`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  removeLedgerEntry(lessonId);
  return true;
}

/** Toutes les leçons signées — injectées en délibération (Loi immortelle). */
export function loadSignedDoctrineForDeliberation(limit = 48): Array<{
  id: string;
  author: DoctrineAuthor;
  title: string;
  body: string;
  createdAt: string;
  signedAt?: string | null;
}> {
  const fromLedger = listLedgerLessons({ status: 'SIGNED', limit });
  if (fromLedger.length > 0) {
    return fromLedger.map((l) => ({
      id: l.id,
      author: l.author,
      title: l.title,
      body: l.body.slice(0, 2000),
      createdAt: l.createdAt,
      signedAt: l.signedAt,
    }));
  }

  const dir = resolveDoctrineDirectory();
  const out: ReturnType<typeof loadSignedDoctrineForDeliberation> = [];
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort()
      .reverse();
    for (const file of files) {
      if (out.length >= limit) break;
      const lesson = parseLessonFile(path.join(dir, file));
      if (!lesson?.body.trim() || lesson.status !== 'SIGNED') continue;
      out.push({
        id: lesson.id,
        author: lesson.author,
        title: lesson.title,
        body: lesson.body.slice(0, 2000),
        createdAt: lesson.createdAt,
        signedAt: lesson.signedAt,
      });
    }
  } catch {
    return [];
  }
  return out;
}

/** Extrait doctrineLesson des rapports experts — Gardien intercepte avant Loi. */
export function captureDoctrineLessonsFromPatches(
  patches: {
    enqueteur?: Record<string, unknown> | null;
    archiviste?: Record<string, unknown> | null;
    majordome?: Record<string, unknown> | null;
  },
  sessionRef?: string,
): DoctrineLesson[] {
  const captured: DoctrineLesson[] = [];
  const tryCapture = (author: DoctrineAuthor, patch?: Record<string, unknown> | null) => {
    if (!patch) return;
    const lesson = patch.doctrineLesson;
    if (typeof lesson === 'string' && lesson.trim()) {
      captured.push(
        appendDoctrineLesson({
          author,
          title: `Leçon ${author} — ${new Date().toISOString().slice(0, 10)}`,
          body: lesson.trim(),
          sessionRef,
          status: 'PENDING_ADMIN_SIGNATURE',
        }),
      );
      return;
    }
    const title = typeof patch.doctrineLessonTitle === 'string' ? patch.doctrineLessonTitle : '';
    const body = typeof patch.doctrineLessonBody === 'string' ? patch.doctrineLessonBody : '';
    if (body.trim()) {
      captured.push(
        appendDoctrineLesson({
          author,
          title: title.trim() || `Leçon ${author}`,
          body: body.trim(),
          sessionRef,
          status: 'PENDING_ADMIN_SIGNATURE',
        }),
      );
    }
  };

  tryCapture('enqueteur', patches.enqueteur);
  tryCapture('archiviste', patches.archiviste);
  tryCapture('majordome', patches.majordome);
  return captured;
}

/** Sujet lisible pour le cockpit Architecte (Lia-Lab). */
export function extractDoctrineSubject(title: string): string {
  return title.replace(/^Leçon\s+\w+\s*—\s*/i, '').trim() || title.trim() || 'sans titre';
}

/** Message Lia → Architecte après délibération réussie (Phase C). */
export function buildArchitectDoctrinePrompt(title: string): string {
  const subject = extractDoctrineSubject(title);
  return `Architecte, j'ai noté une nouvelle leçon sur « ${subject} ». Voulez-vous que je la soumette à votre signature ?`;
}

/** Convertit pour le Gardien / LIVING_BUILDING_STATE. */
export function toPendingDoctrineRecords(
  lessons: DoctrineLesson[],
): import('./living-building-state.types').LivingPendingDoctrineLesson[] {
  return lessons.map((l) => ({
    id: l.id,
    author: l.author,
    title: l.title,
    status: l.status,
    filePath: l.filePath,
  }));
}
