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

  /** Sujet déjà choisi sur l’écran multi-réclamations — ne pas re-bloquer. */
  @IsOptional()
  @IsString()
  claimCategory?: string;

  // Optionnel : si tu veux analyser une photo en mémoire
  @IsOptional()
  photoBuffer?: Buffer;
}
