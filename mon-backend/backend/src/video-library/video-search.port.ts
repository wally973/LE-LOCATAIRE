/**
 * Contexte fourni à l'adapter de recherche vidéo.
 */
export interface VideoSearchInput {
  /** Requête déjà normalisée (lowercase, sans ponctuation, sans stop-words). */
  queryNormalized: string;
  /** Catégorie technique du ticket — sert de bucket de tri / fallback. */
  category: string;
  /** Locale ciblée (fr-FR par défaut Sprint 4). */
  locale: string;
  /** Nombre maximum de résultats à retourner. */
  maxResults: number;
}

/**
 * Résultat brut renvoyé par l'adapter — l'archivage en base est du ressort
 * du VideoLibraryService.
 */
export interface VideoSearchResult {
  youtubeVideoId: string;
  title: string;
  channel?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  language: string;
  /** Score de pertinence dans [0,1] retourné par l'adapter. */
  score: number;
}

/**
 * Port hexagonal : la couche métier ne dépend que de cette interface,
 * jamais d'un fournisseur concret (YouTube, Vimeo, base interne…).
 *
 * Sprint 4 : adapter stub déterministe avec une mini-bibliothèque en dur.
 * Sprint 8+ : adapter `YouTubeDataApiAdapter` (clé API + quotas + filtres).
 */
export interface VideoSearchPort {
  search(input: VideoSearchInput): Promise<VideoSearchResult[]>;
}

/** Token Nest pour l'injection du port. */
export const VIDEO_SEARCH = Symbol('VIDEO_SEARCH');
