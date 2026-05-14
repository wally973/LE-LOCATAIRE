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

export class CreatePaiementDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contratId!: number;

  @ApiProperty({ example: '2025-02-01T12:00:00.000Z' })
  @IsDateString()
  datePaiement!: string;

  @ApiProperty({ example: 750 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montant!: number;

  @ApiProperty({ example: 'VIREMENT', description: 'CB, VIREMENT, ESPECES, CHEQUE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  moyenPaiement!: string;

  @ApiProperty({ example: 'PAYE', description: 'PAYE, EN_RETARD, PARTIEL, ANNULE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  statut!: string;

  @ApiPropertyOptional({ example: 'VIR-2025-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;
}
