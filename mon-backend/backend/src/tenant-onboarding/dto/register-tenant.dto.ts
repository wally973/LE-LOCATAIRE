import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { City } from '@prisma/client';

/**
 * Inscription self-service d'un locataire.
 *
 * Toutes les infos personnelles + l'adresse du logement sont saisies en une fois,
 * de manière à minimiser les allers-retours avec le bailleur lors de la validation.
 */
export class RegisterTenantDto {
  // --- Identité locataire ---
  @ApiProperty({ example: 'Jean' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  firstName!: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  lastName!: string;

  @ApiPropertyOptional({ example: 'jean.dupont@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '+594694123456',
    description: 'Téléphone (format international ou local valide)',
  })
  @Matches(/^\+?[0-9]{8,15}$/, {
    message:
      'Le numéro de téléphone doit être au format international ou local valide',
  })
  phone!: string;

  @ApiProperty({ example: 'monMotDePasse123', description: 'Min. 6 caractères' })
  @IsString()
  @MinLength(6)
  password!: string;

  // --- Choix du bailleur ---
  @ApiProperty({
    example: 1,
    description: 'Identifiant LandlordProfile choisi dans la liste publique',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  landlordProfileId!: number;

  // --- Adresse logement ---
  @ApiProperty({ example: '12 rue des Cocotiers' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @ApiPropertyOptional({ example: 'Bâtiment B' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  building?: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  floor?: string;

  @ApiPropertyOptional({ example: '34' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  apartmentNumber?: string;

  @ApiProperty({ example: '97300' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  postalCode!: string;

  @ApiProperty({ enum: City, example: City.CAYENNE })
  @IsEnum(City)
  city!: City;

  @ApiPropertyOptional({
    example: '2026-06-01T00:00:00.000Z',
    description: 'Date de début souhaitée du contrat (optionnelle)',
  })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;
}
