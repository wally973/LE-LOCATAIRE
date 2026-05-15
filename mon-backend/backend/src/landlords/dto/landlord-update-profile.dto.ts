import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** PATCH /landlords/me — le bailleur met à jour son propre profil. */
export class LandlordUpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^[+]?\d{8,15}$/, {
    message: 'Le numéro de téléphone doit être valide',
  })
  phone?: string;
}
