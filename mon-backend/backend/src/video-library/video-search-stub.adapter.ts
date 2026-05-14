import { Injectable } from '@nestjs/common';
import {
  VideoSearchInput,
  VideoSearchPort,
  VideoSearchResult,
} from './video-search.port';

/**
 * Mini-bibliothèque déterministe — Sprint 4.
 *
 * Objectif : pouvoir tester intégralement le flow vidéo sans dépendre de
 * l'API YouTube (quota, clé, conditions d'utilisation).
 *
 * Les ids YouTube sont des placeholders : ce sont des chaînes de 11
 * caractères qui respectent le format attendu, mais l'application frontend
 * devra de toute façon résoudre l'URL `https://www.youtube.com/watch?v=...`
 * pour les afficher. En production (Sprint 8), un adapter YouTube Data API
 * remplacera celui-ci sans toucher aux consommateurs.
 */
@Injectable()
export class VideoSearchStubAdapter implements VideoSearchPort {
  /**
   * Bibliothèque locale ordonnée par catégorie. Chaque entrée est un
   * candidat plausible ; le tri final est laissé au service.
   */
  private readonly library: Record<string, VideoSearchResult[]> = {
    PLUMBING: [
      {
        youtubeVideoId: 'stubPLUMB001',
        title: 'Comment réparer une fuite de robinet en 5 minutes',
        channel: 'Bricolage Facile',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubPLUMB001/hqdefault.jpg',
        durationSec: 310,
        language: 'fr',
        score: 0.92,
      },
      {
        youtubeVideoId: 'stubPLUMB002',
        title: 'Déboucher un évier sans produit chimique',
        channel: 'Astuces Maison',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubPLUMB002/hqdefault.jpg',
        durationSec: 240,
        language: 'fr',
        score: 0.85,
      },
      {
        youtubeVideoId: 'stubPLUMB003',
        title: 'Remplacer un joint de chasse d’eau',
        channel: 'Plomberie Pratique',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubPLUMB003/hqdefault.jpg',
        durationSec: 420,
        language: 'fr',
        score: 0.8,
      },
    ],
    ELECTRICITY: [
      {
        youtubeVideoId: 'stubELEC0001',
        title: 'Réenclencher un disjoncteur — étape par étape',
        channel: 'Électricité Pratique',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubELEC0001/hqdefault.jpg',
        durationSec: 200,
        language: 'fr',
        score: 0.9,
      },
      {
        youtubeVideoId: 'stubELEC0002',
        title: 'Changer une ampoule de plafonnier en sécurité',
        channel: 'Maison & Bricolage',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubELEC0002/hqdefault.jpg',
        durationSec: 180,
        language: 'fr',
        score: 0.78,
      },
    ],
    HUMIDITY: [
      {
        youtubeVideoId: 'stubHUMID001',
        title: 'Traiter la moisissure sur les murs (méthode douce)',
        channel: 'Maison Saine',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubHUMID001/hqdefault.jpg',
        durationSec: 360,
        language: 'fr',
        score: 0.86,
      },
      {
        youtubeVideoId: 'stubHUMID002',
        title: 'Aérer correctement son logement en climat tropical',
        channel: 'Logement Tropical',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubHUMID002/hqdefault.jpg',
        durationSec: 240,
        language: 'fr',
        score: 0.74,
      },
    ],
    LOCK: [
      {
        youtubeVideoId: 'stubLOCK0001',
        title: 'Débloquer une serrure grippée sans la casser',
        channel: 'Serrurerie Pratique',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubLOCK0001/hqdefault.jpg',
        durationSec: 270,
        language: 'fr',
        score: 0.83,
      },
    ],
    HEATING: [
      {
        youtubeVideoId: 'stubHEAT0001',
        title: 'Pourquoi mon ballon d’eau chaude ne chauffe plus ?',
        channel: 'Chauffage & Énergie',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubHEAT0001/hqdefault.jpg',
        durationSec: 480,
        language: 'fr',
        score: 0.82,
      },
    ],
    OTHER: [
      {
        youtubeVideoId: 'stubOTHER001',
        title: 'Petits travaux locatifs : ce qui est à votre charge',
        channel: 'Le Coin du Locataire',
        thumbnailUrl: 'https://i.ytimg.com/vi/stubOTHER001/hqdefault.jpg',
        durationSec: 600,
        language: 'fr',
        score: 0.65,
      },
    ],
  };

  async search(input: VideoSearchInput): Promise<VideoSearchResult[]> {
    const bucket = this.library[input.category] ?? this.library['OTHER'];

    // Boost basique : si la queryNormalized contient certains mots clés,
    // on remonte la vidéo correspondante.
    const boosted = bucket.map((v) => {
      const titleLower = v.title.toLowerCase();
      const tokens = input.queryNormalized
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      const matches = tokens.filter((t) => titleLower.includes(t)).length;
      return {
        ...v,
        score: Math.min(1, v.score + matches * 0.03),
      };
    });

    return boosted
      .sort((a, b) => b.score - a.score)
      .slice(0, input.maxResults);
  }
}
