import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateArtisanDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
