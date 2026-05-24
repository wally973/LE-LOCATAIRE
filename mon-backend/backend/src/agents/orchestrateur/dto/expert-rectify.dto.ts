import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TicketResponsibility } from '@prisma/client';
import type { ExpertSpecialHandling } from '../../diagnostiqueur/briefing/lia-expert-rectification.types';

const SPECIAL_HANDLING_VALUES = [
  'STRUCTURAL_INFILTRATION',
  'VULNERABLE_TENANT',
] as const;

export class ExpertRectifyDto {
  @ApiProperty({
    example:
      'Infiltration active au plafond — impact structure (dalle / ossature) à confirmer par entreprise.',
  })
  @IsString()
  @MinLength(10, {
    message: 'Décrivez le diagnostic corrigé en au moins 10 caractères.',
  })
  correctedDiagnosis!: string;

  @ApiProperty({
    example: 'Constat terrain : traces sur dalle portée, pas simple condensation locative.',
  })
  @IsString()
  @MinLength(3, { message: 'Indiquez un motif pour la rectification.' })
  reason!: string;

  @ApiPropertyOptional({ example: 'Toiture / dalle / façade' })
  @IsOptional()
  @IsString()
  modelHint?: string;

  @ApiProperty({
    enum: TicketResponsibility,
    example: 'BAILLEUR',
    description: 'Charge retenue après expertise terrain',
  })
  @IsEnum(TicketResponsibility)
  responsibility!: TicketResponsibility;

  @ApiPropertyOptional({
    enum: SPECIAL_HANDLING_VALUES,
    isArray: true,
    description: 'Cas sensibles nécessitant une prise en charge renforcée',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(SPECIAL_HANDLING_VALUES, { each: true })
  specialHandling?: ExpertSpecialHandling[];

  @ApiPropertyOptional({
    example: 'Locataire de 82 ans, mobilité réduite — intervention prioritaire.',
  })
  @IsOptional()
  @IsString()
  vulnerableDetail?: string;

  @ApiPropertyOptional({
    description: 'Le référent porte l’affaire (passe en cours de traitement)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  takeCharge?: boolean;
}
