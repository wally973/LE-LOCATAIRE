import type { TicketResponsibility } from '@prisma/client';

/** Autorité du diagnostic affiché sur l’affaire. */
export type DiagnosticAuthority = 'AI_PROPOSED' | 'EXPERT_VALIDATED';

/** Prise en charge prioritaire par le référent / technicien. */
export type ExpertSpecialHandling =
  | 'STRUCTURAL_INFILTRATION'
  | 'VULNERABLE_TENANT';

export const SPECIAL_HANDLING_LABELS: Record<ExpertSpecialHandling, string> = {
  STRUCTURAL_INFILTRATION: 'Infiltration / structure du bâtiment',
  VULNERABLE_TENANT: 'Locataire âgé ou en situation de handicap',
};

/** Référent qui porte l’affaire après rectification. */
export interface ExpertTakeCharge {
  expertUserId: number;
  expertDisplayName: string;
  takenAt: string;
}

/** Rectification expert persistée dans `ticket.aiLastDecision`. */
export interface ExpertRectificationStored {
  authority: DiagnosticAuthority;
  expertUserId: number;
  expertDisplayName: string;
  reason: string;
  /** Diagnostic terrain retenu (remplace la lecture IA pour la suite). */
  correctedDiagnosis: string;
  modelHint?: string | null;
  responsibilityOverride?: TicketResponsibility | null;
  specialHandling: ExpertSpecialHandling[];
  vulnerableDetail?: string | null;
  takeCharge?: boolean;
  correctedAt: string;
  /** Archive JSON de la décision IA avant override. */
  aiSnapshotBeforeOverride: unknown;
}

export interface ExpertRectifyInput {
  correctedDiagnosis: string;
  reason: string;
  modelHint?: string;
  responsibility?: TicketResponsibility;
  specialHandling?: ExpertSpecialHandling[];
  vulnerableDetail?: string;
  /** Le référent porte le dossier (statut → en cours). */
  takeCharge?: boolean;
}

export interface ExpertRectifyResult {
  ticketId: number;
  authority: DiagnosticAuthority;
  messageForTenant: string;
  expertRectification: ExpertRectificationStored;
}

export function parseExpertRectification(
  aiLastDecision: unknown,
): ExpertRectificationStored | null {
  if (!aiLastDecision || typeof aiLastDecision !== 'object') return null;
  const raw = (aiLastDecision as { expertRectification?: ExpertRectificationStored })
    .expertRectification;
  if (!raw || raw.authority !== 'EXPERT_VALIDATED') return null;
  if (!raw.correctedDiagnosis?.trim()) return null;
  return {
    ...raw,
    specialHandling: raw.specialHandling ?? [],
    takeCharge: raw.takeCharge ?? false,
  };
}

export function isExpertValidated(aiLastDecision: unknown): boolean {
  return parseExpertRectification(aiLastDecision) != null;
}
