import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateArtisanDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
