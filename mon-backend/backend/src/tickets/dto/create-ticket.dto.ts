import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  housingId: number;

  // Optionnel : si tu veux analyser une photo en mémoire
  @IsOptional()
  photoBuffer?: Buffer;
}
