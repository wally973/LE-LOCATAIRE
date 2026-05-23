/** Réponse structurée Expert-Compagnon (API + mobile avatar / guide photo). */
export type CompanionSafetyLevel = 'green' | 'yellow' | 'red';
export type CompanionLanguage = 'fr' | 'gcf' | 'hat' | 'es' | 'en' | 'pt';
export type CompanionLandlordHint = 'BAILLEUR' | 'LOCATAIRE' | 'NUANCE' | null;

export interface CompanionResponse {
  speech: string;
  language: CompanionLanguage;
  avatar_action: string;
  avatar_position: string;
  search_trigger: string | null;
  safety_level: CompanionSafetyLevel;
  photo_requested: boolean;
  landlord_hint: CompanionLandlordHint;
  photo_guidance_steps: string[];
}

/** État persisté dans ticket.aiLastDecision.companion */
export interface CompanionUiState {
  lastSpeech: string;
  language: CompanionLanguage;
  avatar_action: string;
  avatar_position: string;
  safety_level: CompanionSafetyLevel;
  photo_requested: boolean;
  landlord_hint: CompanionLandlordHint;
  photo_guidance_steps: string[];
  search_trigger: string | null;
  updatedAt: string;
}

export function parseCompanionState(aiLastDecision: unknown): CompanionUiState | null {
  if (!aiLastDecision || typeof aiLastDecision !== 'object') return null;
  const raw = (aiLastDecision as { companion?: CompanionUiState }).companion;
  if (!raw?.lastSpeech) return null;
  return raw;
}

export function toCompanionUiState(res: CompanionResponse): CompanionUiState {
  return {
    lastSpeech: res.speech,
    language: res.language,
    avatar_action: res.avatar_action,
    avatar_position: res.avatar_position,
    safety_level: res.safety_level,
    photo_requested: res.photo_requested,
    landlord_hint: res.landlord_hint,
    photo_guidance_steps: res.photo_guidance_steps ?? [],
    search_trigger: res.search_trigger,
    updatedAt: new Date().toISOString(),
  };
}
