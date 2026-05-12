import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RecordAiDiagnosticDto {
  @IsString()
  @MaxLength(16)
  locale!: string;

  @IsString()
  @MaxLength(64)
  category!: string;

  @IsString()
  @IsIn(['low', 'medium', 'high'])
  severity!: string;

  @IsString()
  @IsIn(['ADMIN', 'BAILLEUR', 'PRESTATAIRE', 'NONE'])
  target!: string;

  @IsBoolean()
  refused!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  refusalReason?: string;

  /** Jamais le texte brut utilisateur ; résumé métier nettoyé (RGPD). */
  @IsString()
  @MaxLength(3900)
  diagnosticSummary!: string;

  @IsOptional()
  @IsObject()
  pipelineSteps?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  avatarVariant?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  artisanType?: string;

  @IsBoolean()
  bailleurFlag!: boolean;

  @IsBoolean()
  adminFlag!: boolean;
}
