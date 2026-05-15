import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLandlordDto {
  @ApiProperty({ description: 'Adresse email du bailleur' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Numéro de téléphone du bailleur' })
  @Matches(/^[+]?\d{8,15}$/, {
    message: 'Le numéro de téléphone doit être valide',
  })
  phone: string;

  @ApiProperty({ description: 'Mot de passe du bailleur (min 6 caractères)' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Nom complet du bailleur' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'URL du logo du bailleur', required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

/** PATCH /admin/landlords/:id — modification par un administrateur. */
export class AdminUpdateLandlordDto {
  @ApiProperty({ description: 'Adresse email', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Numéro de téléphone', required: false })
  @IsOptional()
  @Matches(/^[+]?\d{8,15}$/, {
    message: 'Le numéro de téléphone doit être valide',
  })
  phone?: string;

  @ApiProperty({ description: 'Nom du bailleur', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'URL du logo du bailleur', required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}
