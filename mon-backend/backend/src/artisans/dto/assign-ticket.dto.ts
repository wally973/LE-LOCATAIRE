import { IsInt } from 'class-validator';

export class AssignTicketDto {
  @IsInt()
  artisanId: number;

  @IsInt()
  ticketId: number;
}
