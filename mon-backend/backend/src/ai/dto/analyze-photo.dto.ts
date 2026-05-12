import { IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyzePhotoDto {
  @ApiProperty({
    description: 'URL de la photo envoyée par le locataire',
    example: 'https://cdn.example.com/photos/incident-123.jpg',
  })
  @IsString()
  @IsUrl()
  url: string;
}
