/**
 * Stylo des agents — capture de sagesse dans knowledge/doctrine/.
 * Phase C N7 : le LLM écrit ses leçons ; l'Architecte valide en amont produit.
 */
import * as fs from 'fs';
import * as path from 'path';

export type DoctrineAuthor = 'enqueteur' | 'archiviste' | 'majordome' | 'architecte';

export interface DoctrineLesson {
  id: string;
  author: DoctrineAuthor;
  title: string;
  body: string;
  createdAt: string;
  sessionRef?: string;
  filePath: string;
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
    const id = path.basename(filePath, '.md');
    return { id, author, title, body, createdAt, sessionRef, filePath };
  } catch {
    return null;
  }
}

/** Charge les leçons pour enrichir la bibliothèque agents (sans commentaire interprété). */
export function loadDoctrineBibliotheque(limit = 12): Array<{
  id: string;
  author: DoctrineAuthor;
  title: string;
  body: string;
  createdAt: string;
}> {
  const dir = resolveDoctrineDirectory();
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort()
      .reverse();
  } catch {
    return [];
  }

  const out: ReturnType<typeof loadDoctrineBibliotheque> = [];
  for (const file of files) {
    if (out.length >= limit) break;
    const lesson = parseLessonFile(path.join(dir, file));
    if (!lesson?.body.trim()) continue;
    out.push({
      id: lesson.id,
      author: lesson.author,
      title: lesson.title,
      body: lesson.body.slice(0, 2000),
      createdAt: lesson.createdAt,
    });
  }
  return out;
}

/** Le Stylo — écrit une leçon proposée par un agent après délibération. */
export function appendDoctrineLesson(params: {
  author: DoctrineAuthor;
  title: string;
  body: string;
  sessionRef?: string;
}): DoctrineLesson {
  const dir = resolveDoctrineDirectory();
  const title = params.title.trim() || 'Leçon sans titre';
  const body = params.body.trim();
  if (!body) {
    throw new Error('Stylo — corps de leçon vide');
  }

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
    params.sessionRef ? `sessionRef: ${params.sessionRef}` : '',
    `title: ${title}`,
    '---',
    '',
    body,
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(filePath, frontMatter, 'utf8');

  return {
    id: path.basename(fileName, '.md'),
    author: params.author,
    title,
    body,
    createdAt,
    sessionRef: params.sessionRef,
    filePath,
  };
}

/** Extrait doctrineLesson des rapports experts et écrit si présent. */
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
        }),
      );
    }
  };

  tryCapture('enqueteur', patches.enqueteur);
  tryCapture('archiviste', patches.archiviste);
  tryCapture('majordome', patches.majordome);
  return captured;
}
