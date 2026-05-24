import { Injectable } from '@nestjs/common';
import { AnalyzePhotoDto } from './dto/analyze-photo.dto';
import { AiPhotoService } from './ai-photo.service';

/**
 * Façade API legacy — délègue l’analyse photo au pathologiste (plus de stub URL).
 */
@Injectable()
export class AiService {
  constructor(private readonly aiPhoto: AiPhotoService) {}

  analyzePhoto(dto: AnalyzePhotoDto) {
    return this.aiPhoto.analyzePhoto(dto.url, {
      ticketId: dto.ticketId,
      title: dto.title,
      description: dto.description,
    });
  }
}
