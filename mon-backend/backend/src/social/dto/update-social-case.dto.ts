import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SocialCaseCategory,
  SocialCasePriority,
  SocialCaseStatus,
} from '@prisma/client';

/**
 * Mise à jour d'un dossier social — champs optionnels (patch partiel).
 */
export class UpdateSocialCaseDto {
  @IsOptional()
  @IsEnum(SocialCaseStatus)
  status?: SocialCaseStatus;

  @IsOptional()
  @IsEnum(SocialCaseCategory)
  category?: SocialCaseCategory;

  @IsOptional()
  @IsEnum(SocialCasePriority)
  priority?: SocialCasePriority;

  /** Fragment de note à ajouter (sera préfixé date + acteur — P5). */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  noteAppend?: string;

  @IsOptional()
  @IsInt()
  assignedSocialWorkerId?: number | null;

  @IsOptional()
  @IsDateString()
  lastContactAt?: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;

  /** Obligatoire si status = CLOSED (ou si le patch impose la clôture). */
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  closedReason?: string;
}
