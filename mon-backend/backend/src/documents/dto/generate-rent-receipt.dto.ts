import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class GenerateRentReceiptDto {
  @ApiProperty({ description: 'ID du locataire' })
  @IsNumber()
  tenantId: number;

  @ApiProperty({ description: 'ID du logement' })
  @IsNumber()
  housingId: number;

  @ApiProperty({ description: 'Montant du loyer payé' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Mois concerné au format YYYY-MM', example: '2026-04' })
  @IsString()
  @IsNotEmpty()
  month: string;
}
