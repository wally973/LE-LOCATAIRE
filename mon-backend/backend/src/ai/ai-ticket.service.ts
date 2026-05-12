import { Injectable } from '@nestjs/common';

@Injectable()
export class AiTicketService {
  constructor() {}

  /**
   * Analyse un ticket à partir du texte (description)
   * Retourne une catégorie, une sévérité et un score de confiance
   */
  async analyze(description: string) {
    if (!description || description.trim().length === 0) {
      return null;
    }

    // --- IA SIMPLIFIÉE POUR MVP ---
    // Ici tu peux brancher OpenAI, Gemini, Azure OpenAI, etc.
    // Pour l’instant on fait une logique simple et propre.

    const text = description.toLowerCase();

    let category = 'OTHER';
    let severity = 'LOW';
    let confidence = 0.7;

    if (text.includes('fuite') || text.includes('eau') || text.includes('plomberie')) {
      category = 'PLUMBING';
      severity = text.includes('urgence') || text.includes('inondation') ? 'HIGH' : 'MEDIUM';
      confidence = 0.9;
    }

    if (text.includes('électricité') || text.includes('prise') || text.includes('court-circuit')) {
      category = 'ELECTRICITY';
      severity = text.includes('étincelle') || text.includes('brûle') ? 'HIGH' : 'MEDIUM';
      confidence = 0.9;
    }

    if (text.includes('moisissure') || text.includes('humidité')) {
      category = 'HUMIDITY';
      severity = 'MEDIUM';
      confidence = 0.85;
    }

    if (text.includes('porte') || text.includes('serrure') || text.includes('clé')) {
      category = 'LOCK';
      severity = 'LOW';
      confidence = 0.8;
    }

    return {
      category,
      severity,
      confidence,
    };
  }

  /**
   * Analyse d’une photo en mémoire (optionnel)
   * Tu peux l’activer plus tard si tu veux
   */
  async analyzeFromBuffer(buffer: Buffer) {
    // Pour l’instant, on ne fait rien avec les photos
    // Tu pourras brancher une IA vision plus tard
    return null;
  }
}
