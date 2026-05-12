import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Corps pour activer ou désactiver un compte utilisateur (soft delete). */
export class SetUserAvailabilityDto {
  @ApiProperty({ description: 'false = compte désactivé (ne peut plus se connecter)' })
  @IsBoolean()
  isAvailable: boolean;
}
