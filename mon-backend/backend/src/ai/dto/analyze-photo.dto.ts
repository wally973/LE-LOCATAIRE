import { IsInt, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyzePhotoDto {
  @ApiProperty({
    description: 'URL de la photo envoyée par le locataire',
    example: 'https://cdn.example.com/photos/incident-123.jpg',
  })
  @IsString()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'Ticket lié (capteurs depuis DiagnosticContextService)' })
  @IsOptional()
  @IsInt()
  ticketId?: number;

  @ApiPropertyOptional({ description: 'Titre du signalement (extraction capteurs sans ticket)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Description du signalement' })
  @IsOptional()
  @IsString()
  description?: string;
}
