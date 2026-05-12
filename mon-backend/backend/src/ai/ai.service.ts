import { Injectable } from '@nestjs/common';
import { AnalyzePhotoDto } from './dto/analyze-photo.dto';

@Injectable()
export class AiService {
  async analyzePhoto(dto: AnalyzePhotoDto) {
    const { url } = dto;

    const aiResult = await this.fakeAiAnalysis(url);

    return {
      url,
      category: aiResult.category,
      severity: aiResult.severity,
      confidence: aiResult.confidence,
      suggestions: aiResult.suggestions,
    };
  }

  private async fakeAiAnalysis(url: string) {
    const lower = url.toLowerCase();

    if (lower.includes('water') || lower.includes('leak')) {
      return {
        category: 'Plomberie',
        severity: 'HIGH',
        confidence: 0.92,
        suggestions: ['Couper l’eau', 'Contacter un plombier en urgence'],
      };
    }

    if (lower.includes('mold')) {
      return {
        category: 'Moisissure',
        severity: 'MEDIUM',
        confidence: 0.88,
        suggestions: ['Aérer la pièce', 'Nettoyage anti-fongique'],
      };
    }

    return {
      category: 'Inconnu',
      severity: 'LOW',
      confidence: 0.55,
      suggestions: ['Demander une photo plus claire'],
    };
  }
}
