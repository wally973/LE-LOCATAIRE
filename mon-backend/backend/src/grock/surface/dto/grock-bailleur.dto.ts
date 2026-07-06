import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { GrockChatMessage } from '../../grock.service';

/** Dialogue bailleur ↔ Grock sur un ticket du parc. */
export class ConverseGrockLandlordDto {
  @IsInt()
  @Min(1)
  ticketId!: number;

  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsArray()
  sessionMessages?: GrockChatMessage[];
}
