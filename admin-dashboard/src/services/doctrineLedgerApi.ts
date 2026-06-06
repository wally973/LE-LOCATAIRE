import { apiClient, getErrorMessage } from './apiClient';

export type DoctrineLessonStatus = 'PENDING_ADMIN_SIGNATURE' | 'SIGNED';

export type DoctrineAuthor = 'enqueteur' | 'archiviste' | 'majordome' | 'architecte';

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
  filePath?: string;
}

export interface DoctrineLedgerResponse {
  ledger: {
    schema: string;
    version: number;
    updatedAt: string;
    lessons: DoctrineLedgerEntry[];
  };
  lessons: DoctrineLedgerEntry[];
}

export async function fetchPendingDoctrineLessons(): Promise<DoctrineLedgerEntry[]> {
  const { data } = await apiClient.get<{ lessons: DoctrineLedgerEntry[] }>(
    '/doctrine-ledger/pending',
  );
  return data.lessons ?? [];
}

export async function fetchDoctrineLedger(
  status?: DoctrineLessonStatus,
): Promise<DoctrineLedgerResponse> {
  const { data } = await apiClient.get<DoctrineLedgerResponse>('/doctrine-ledger', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function signDoctrineLesson(id: string): Promise<DoctrineLedgerEntry> {
  const { data } = await apiClient.post<{ lesson: DoctrineLedgerEntry }>(
    `/doctrine-ledger/${encodeURIComponent(id)}/sign`,
  );
  return data.lesson;
}

export async function rejectDoctrineLesson(id: string): Promise<void> {
  await apiClient.delete(`/doctrine-ledger/${encodeURIComponent(id)}`);
}

export function getDoctrineLedgerErrorMessage(err: unknown, fallback: string): string {
  return getErrorMessage(err, fallback);
}

export const DOCTRINE_AUTHOR_LABELS: Record<DoctrineAuthor, string> = {
  enqueteur: 'Enquêteur',
  archiviste: 'Archiviste',
  majordome: 'Majordome',
  architecte: 'Architecte',
};
