import { IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class UpdateTenantProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+]?\d{8,15}$/, { message: 'Téléphone invalide' })
  phone?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;
}
