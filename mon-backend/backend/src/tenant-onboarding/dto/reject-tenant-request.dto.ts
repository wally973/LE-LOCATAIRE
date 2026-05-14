import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectTenantRequestDto {
  @ApiProperty({
    example:
      'Le logement déclaré ne fait pas partie de notre parc, merci de vérifier.',
    description: 'Motif de refus communiqué au locataire',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  reason!: string;
}
