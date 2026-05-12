import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ description: 'Adresse email de l’utilisateur' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Numéro de téléphone de l’utilisateur' })
  @Matches(/^\+?[0-9]{8,15}$/, {
    message: 'Le numéro de téléphone doit être au format international ou local valide',
  })
  phone: string;

  @ApiProperty({ description: 'Mot de passe (min. 6 caractères)' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: Role, description: 'Rôle assigné au compte', required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
