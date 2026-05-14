import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Données fournies par le bailleur (ou son agent) au moment de l'approbation
 * d'une demande d'inscription locataire.
 *
 * - Si `housingId` est fourni, le `TenantProfile` créé est lié à un logement
 *   existant du parc du bailleur.
 * - Sinon, on crée automatiquement un nouveau `Housing` à partir du snapshot
 *   d'adresse de la demande (address, building, floor, apartmentNumber,
 *   postalCode, city).
 */
export class ApproveTenantRequestDto {
  @ApiPropertyOptional({
    example: 12,
    description:
      'Identifiant Housing existant à associer. Si non fourni, un nouveau logement est créé.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  housingId?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Identifiant Agence (secteur) à associer au logement créé',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  agenceId?: number;
}
