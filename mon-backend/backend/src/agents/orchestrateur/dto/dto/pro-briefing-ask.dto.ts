import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ProBriefingAskDto {
  @ApiProperty({
    example: 'Le locataire a-t-il tenté de déboucher le siphon ?',
    description: 'Question en langage naturel sur le dossier',
  })
  @IsString()
  @MinLength(3, { message: 'La question doit contenir au moins 3 caractères.' })
  question!: string;
}
