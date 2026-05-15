import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Options pour forcer ou désactiver un canal sur un envoi ponctuel.
 */
export class NotifyUserOptionsDto {
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  sendPush?: boolean;
}
