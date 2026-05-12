import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ description: 'ID du logement associé au document' })
  @IsNumber()
  housingId: number;

  @ApiProperty({ description: 'ID du locataire (optionnel)', required: false })
  @IsOptional()
  @IsNumber()
  tenantId?: number;

  @ApiProperty({ description: 'Type de document', example: 'ASSURANCE_HABITATION' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Nom du fichier original' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: 'Notes ou informations supplémentaires', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
