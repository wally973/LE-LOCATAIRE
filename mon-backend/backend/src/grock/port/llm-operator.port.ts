/**
 * PORT IA — Couche 1 de l'architecture Grock.
 *
 * La seule porte par laquelle le noyau Grock parle à un modèle de langage.
 * Grock ne connaît QUE cette interface : le modèle concret (Mistral, GPT,
 * Claude, Llama…) est branché derrière et reste interchangeable.
 *
 * La vision est une propriété de cette couche : l'opérateur peut VOIR l'image
 * directement (multimodal) — plus de « jeu du téléphone » où seul un texte de
 * perception circulait jusqu'au raisonnement.
 */

/** Jeton d'injection NestJS du port (voir grock.module). */
export const LLM_OPERATOR = Symbol('LLM_OPERATOR');

/** Image transmise à l'opérateur (perception ou vue directe du raisonnement). */
export interface LlmOperatorImage {
  mimeType: string;
  base64: string;
}

/** Un tour de dialogue (locataire = user, Grock = assistant). */
export interface LlmOperatorTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Requête de raisonnement multimodal (les 5 têtes sont portées par le prompt). */
export interface LlmReasoningRequest {
  systemPrompt: string;
  turns: LlmOperatorTurn[];
  maxTokens: number;
  json?: boolean;
  timeoutMs?: number;
  /** Image(s) du tour courant : l'opérateur les VOIT en raisonnant. */
  images?: LlmOperatorImage[];
}

/** Requête de perception brute (œil neutre, sans diagnostic). */
export interface LlmVisionRequest {
  systemPrompt: string;
  userText: string;
  image: LlmOperatorImage;
  maxTokens: number;
  timeoutMs?: number;
}

/** Sortie de l'opérateur : texte produit + modèle réellement utilisé. */
export interface LlmOperatorResult {
  text: string;
  model: string;
}

export interface LlmOperatorPort {
  /** L'opérateur est-il configuré (clé API présente, non désactivé) ? */
  isConfigured(): boolean;

  /** Raisonnement (texte + éventuelle vue directe de l'image). */
  reason(request: LlmReasoningRequest): Promise<LlmOperatorResult | null>;

  /** Œil neutre : perception brute d'une image, sans conclure. */
  see(request: LlmVisionRequest): Promise<LlmOperatorResult | null>;

  /** Message d'indisponibilité lisible (dernière erreur opérateur). */
  describeFailure(): string;
}
