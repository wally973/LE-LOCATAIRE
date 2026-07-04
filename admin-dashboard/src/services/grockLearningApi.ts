import { apiClient, getErrorMessage } from './apiClient';

export type GrockProbeKind =
  | 'variance_cadrage'
  | 'fuite'
  | 'degenerescence'
  | 'preuve_avant_conclusion';

export type GrockProbeSeverity = 'info' | 'warn' | 'high';

export interface GrockLessonCandidate {
  kind: GrockProbeKind;
  severity: GrockProbeSeverity;
  photoHash?: string | null;
  rowIds: string[];
  summary: string;
  evidence: string[];
}

export interface GrockCandidatesResponse {
  analyzed: number;
  byKind: Record<string, number>;
  candidates: GrockLessonCandidate[];
}

export type GrockDomain =
  | 'CARPENTRY_LOCK'
  | 'PLUMBING_WATER'
  | 'HUMIDITY_ENVELOPE'
  | 'ELECTRICITY'
  | 'GENERAL'
  | 'ALL';

export interface GrockLesson {
  id: string;
  status: 'draft' | 'validated';
  appliesTo: GrockDomain[];
  principle: string;
  reasoningShift: string;
  thinkingInstruction: string;
  acknowledgmentInstruction: string;
  examples?: string[];
  createdAt?: string;
  signataire?: string;
  signedAt?: string;
  sourceCandidate?: { kind: string; photoHash?: string | null };
}

export interface GrockLessonsResponse {
  version: number;
  updatedAt: string;
  principles: GrockLesson[];
}

export interface ProposeGrockLessonBody {
  id: string;
  appliesTo: GrockDomain[];
  principle: string;
  reasoningShift: string;
  thinkingInstruction: string;
  acknowledgmentInstruction: string;
  examples?: string[];
  sourceKind?: string;
  sourcePhotoHash?: string;
}

export const GROCK_PROBE_LABELS: Record<GrockProbeKind, string> = {
  variance_cadrage: 'Décision sensible au cadrage',
  fuite: 'Fuite d’identifiant interne',
  degenerescence: 'Parole dégénérée',
  preuve_avant_conclusion: 'Conclusion sans preuve',
};

export const GROCK_DOMAINS: GrockDomain[] = [
  'GENERAL',
  'PLUMBING_WATER',
  'HUMIDITY_ENVELOPE',
  'ELECTRICITY',
  'CARPENTRY_LOCK',
  'ALL',
];

export async function fetchGrockCandidates(
  limit = 500,
): Promise<GrockCandidatesResponse> {
  const { data } = await apiClient.get<GrockCandidatesResponse>(
    '/grock-learning/candidates',
    { params: { limit } },
  );
  return data;
}

export async function fetchGrockLessons(
  status?: 'draft' | 'validated',
): Promise<GrockLessonsResponse> {
  const { data } = await apiClient.get<GrockLessonsResponse>(
    '/grock-learning/lessons',
    { params: status ? { status } : undefined },
  );
  return data;
}

export async function proposeGrockLesson(
  body: ProposeGrockLessonBody,
): Promise<GrockLesson> {
  const { data } = await apiClient.post<{ lesson: GrockLesson }>(
    '/grock-learning/lessons',
    body,
  );
  return data.lesson;
}

export async function signGrockLesson(id: string): Promise<GrockLesson> {
  const { data } = await apiClient.post<{ lesson: GrockLesson }>(
    `/grock-learning/lessons/${encodeURIComponent(id)}/sign`,
  );
  return data.lesson;
}

export async function rejectGrockLesson(id: string): Promise<void> {
  await apiClient.delete(`/grock-learning/lessons/${encodeURIComponent(id)}`);
}

export function getGrockLearningErrorMessage(
  err: unknown,
  fallback: string,
): string {
  return getErrorMessage(err, fallback);
}
