import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PostTicketMessageDto {
  @ApiProperty({ example: 'La fuite continue sous l’évier depuis hier soir.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}
