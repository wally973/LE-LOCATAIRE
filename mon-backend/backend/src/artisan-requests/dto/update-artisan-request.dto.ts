import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ArtisanRequestStatus } from '@prisma/client';

/**
 * Body envoyé par l'admin (toi) pour faire évoluer une demande d'artisan.
 * Tous les champs sont facultatifs : on patche ce qui est fourni.
 */
export class UpdateArtisanRequestDto {
  @IsOptional()
  @IsEnum(ArtisanRequestStatus)
  status?: ArtisanRequestStatus;

  /** Notes internes (visibles uniquement par l'admin). */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminNotes?: string;

  /** ISO date du créneau proposé (avant confirmation). */
  @IsOptional()
  @IsDateString()
  slotProposedAt?: string;

  /** ISO date du créneau confirmé par le locataire ou figé par l'admin. */
  @IsOptional()
  @IsDateString()
  slotConfirmedAt?: string;

  /** ISO date de fin d'intervention (passe automatiquement le statut en DONE). */
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
