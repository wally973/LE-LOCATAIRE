import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateContratDto {
  @ApiProperty({ example: 1, description: 'Identifiant LandlordProfile du bailleur' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  landlordProfileId!: number;

  @ApiProperty({ example: 2, description: 'Identifiant TenantProfile du locataire' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenantProfileId!: number;

  @ApiProperty({ example: 3, description: 'Identifiant Housing du logement' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  housingId!: number;

  @ApiProperty({ example: '2025-01-15T00:00:00.000Z' })
  @IsDateString()
  dateDebut!: string;

  @ApiPropertyOptional({ example: '2026-01-14T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiProperty({ example: 750 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  loyerMensuel!: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depotGarantie?: number;

  @ApiProperty({ example: 'ACTIF', description: 'ACTIF, RESILIE, EN_ATTENTE, etc.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  statut!: string;
}
