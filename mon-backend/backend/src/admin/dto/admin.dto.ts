import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Payload pour créer un compte administrateur (mot de passe hashé côté service). */
export class CreateAdminDto {
  @ApiProperty({ description: 'Adresse email de l\'admin' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Numéro de téléphone de l\'admin' })
  @Matches(/^[+]?\d{8,15}$/, {
    message: 'Le numéro de téléphone doit être valide',
  })
  phone: string;

  @ApiProperty({ description: 'Mot de passe de l\'admin (min 6 caractères)' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

/** Mise à jour partielle d’un administrateur (email / téléphone). */
export class UpdateAdminDto {
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
}
