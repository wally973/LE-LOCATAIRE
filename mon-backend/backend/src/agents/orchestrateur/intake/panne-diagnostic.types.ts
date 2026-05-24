/** Types pour data/panne-diagnostic-logique.json (IA Organisateur). */

export type PanneDangerLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PanneDiscriminantQuestion {
  id: string;
  text: string;
  eliminatesIf: string[];
  eliminatesIfMeaning: string;
}

export interface PanneCause {
  id: string;
  label: string;
  probabilityGuyane: number;
  discriminantQuestion: PanneDiscriminantQuestion;
  danger: { level: PanneDangerLevel; description: string | null };
  responsibilityHint: string;
  skipOtherQuestions?: boolean;
}

export interface PanneDiagnosticTree {
  id: string;
  label: string;
  category: string;
  scope: 'LOGEMENT' | 'BATIMENT' | 'RESIDENCE';
  keywords: string[];
  organizerPriority: string[];
  causes: PanneCause[];
}

export interface PanneDiagnosticCatalog {
  schemaVersion: number;
  region: string;
  updatedAt: string;
  description: string;
  methodology: Record<string, string>;
  dangerLevels: Record<PanneDangerLevel, string>;
  panes: PanneDiagnosticTree[];
  organizerGlobalRules: string[];
  panneDetectionHints: Array<{ panneId: string; patterns: string[] }>;
}
