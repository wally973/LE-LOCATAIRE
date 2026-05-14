import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body envoyé par le locataire pour confirmer qu'il accepte un artisan
 * (à sa charge — Sprint 4, P4 décidé : pas de prix indicatif).
 */
export class CreateArtisanRequestDto {
  /** Raison libre saisie par le locataire (facultatif). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
