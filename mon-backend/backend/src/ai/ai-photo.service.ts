import { Injectable } from '@nestjs/common';

@Injectable()
export class AiPhotoService {
  constructor() {}

  /**
   * Analyse une photo pour un ticket
   * Retourne une analyse basique pour l'instant
   */
  async analyzePhoto(photoUrl: string) {
    // Simulation d'analyse IA
    return {
      category: 'GENERAL',
      description: 'Photo analysée',
      confidence: 0.8,
    };
  }
}