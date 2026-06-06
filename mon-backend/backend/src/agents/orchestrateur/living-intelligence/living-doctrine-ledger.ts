/**
 * JARVIS_DOCTRINE_LEDGER — registre structuré des leçons (Phase C).
 * Source de vérité indexée ; fichiers .md restent le corps documentaire.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { DoctrineAuthor, DoctrineLesson, DoctrineLessonStatus } from './living-doctrine-stylo';
import { resolveDoctrineDirectory } from './living-doctrine-stylo';

export interface DoctrineLedgerEntry {
  id: string;
  title: string;
  body: string;
  author: DoctrineAuthor;
  createdAt: string;
  status: DoctrineLessonStatus;
  signedAt?: string | null;
  signedBy?: string | null;
  sessionRef?: string;
  filePath: string;
}

export interface JarvisDoctrineLedger {
  schema: 'JARVIS_DOCTRINE_LEDGER';
  version: 1;
  updatedAt: string;
  lessons: DoctrineLedgerEntry[];
}

export function resolveLedgerPath(): string {
  return path.join(resolveDoctrineDirectory(), 'JARVIS_DOCTRINE_LEDGER.json');
}

export function emptyLedger(): JarvisDoctrineLedger {
  return {
    schema: 'JARVIS_DOCTRINE_LEDGER',
    version: 1,
    updatedAt: new Date().toISOString(),
    lessons: [],
  };
}

export function readDoctrineLedger(): JarvisDoctrineLedger {
  const filePath = resolveLedgerPath();
  if (!fs.existsSync(filePath)) {
    return emptyLedger();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as JarvisDoctrineLedger;
    if (raw.schema !== 'JARVIS_DOCTRINE_LEDGER' || !Array.isArray(raw.lessons)) {
      return emptyLedger();
    }
    return raw;
  } catch {
    return emptyLedger();
  }
}

export function writeDoctrineLedger(ledger: JarvisDoctrineLedger): void {
  const dir = resolveDoctrineDirectory();
  fs.mkdirSync(dir, { recursive: true });
  const next: JarvisDoctrineLedger = {
    ...ledger,
    schema: 'JARVIS_DOCTRINE_LEDGER',
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(resolveLedgerPath(), JSON.stringify(next, null, 2), 'utf8');
}

export function lessonToLedgerEntry(lesson: DoctrineLesson): DoctrineLedgerEntry {
  return {
    id: lesson.id,
    title: lesson.title,
    body: lesson.body,
    author: lesson.author,
    createdAt: lesson.createdAt,
    status: lesson.status,
    signedAt: lesson.signedAt ?? null,
    signedBy: lesson.signedBy ?? null,
    sessionRef: lesson.sessionRef,
    filePath: lesson.filePath,
  };
}

export function upsertLedgerEntry(lesson: DoctrineLesson): JarvisDoctrineLedger {
  const ledger = readDoctrineLedger();
  const entry = lessonToLedgerEntry(lesson);
  const idx = ledger.lessons.findIndex((l) => l.id === entry.id);
  if (idx >= 0) ledger.lessons[idx] = entry;
  else ledger.lessons.unshift(entry);
  writeDoctrineLedger(ledger);
  return ledger;
}

export function removeLedgerEntry(lessonId: string): JarvisDoctrineLedger {
  const ledger = readDoctrineLedger();
  ledger.lessons = ledger.lessons.filter((l) => l.id !== lessonId);
  writeDoctrineLedger(ledger);
  return ledger;
}

export function listLedgerLessons(params?: {
  status?: DoctrineLessonStatus;
  limit?: number;
}): DoctrineLedgerEntry[] {
  let lessons = readDoctrineLedger().lessons;
  if (params?.status) {
    lessons = lessons.filter((l) => l.status === params.status);
  }
  lessons = [...lessons].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (params?.limit) return lessons.slice(0, params.limit);
  return lessons;
}
