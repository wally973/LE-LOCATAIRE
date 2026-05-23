import { IsBoolean, IsOptional } from 'class-validator';
import { QUALIFICATION_FLAG_KEYS } from '../qualification-flags.types';

/** PATCH partiel — le bailleur règle les actions de qualification (Q63). */
export class UpdateQualificationFlagsDto {
  @IsOptional()
  @IsBoolean()
  liaConversationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  requirePhotoEvidence?: boolean;

  @IsOptional()
  @IsBoolean()
  liaAutoResearchEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  technicianCreateTicketEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  liaTicketRelanceEnabled?: boolean;
}

export { QUALIFICATION_FLAG_KEYS };
