import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Token de rafraîchissement JWT' })
  @IsString()
  refreshToken: string;
}
