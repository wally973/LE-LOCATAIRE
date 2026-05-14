import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Retour locataire sur une vidéo proposée — utilisé par
 * POST /tickets/:id/videos/:suggestionId/feedback
 */
export class VideoFeedbackDto {
  /** A-t-il regardé la vidéo (au moins en partie) ? */
  @IsOptional()
  @IsBoolean()
  watched?: boolean;

  /** Vidéo utile (true) / pas utile (false) / inconnu (omis) */
  @IsOptional()
  @IsBoolean()
  helpful?: boolean;

  /** Commentaire libre — facultatif, plafonné à 1000 caractères */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}
