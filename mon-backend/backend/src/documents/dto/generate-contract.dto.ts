import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class GenerateContractDto {
  @ApiProperty({ description: 'ID du logement concerné' })
  @IsNumber()
  housingId: number;

  @ApiProperty({ description: 'ID du locataire concerné' })
  @IsNumber()
  tenantId: number;

  @ApiProperty({ description: 'Type de contrat à générer', example: 'BAIL_LOCATION' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Notes ou clauses supplémentaires', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
