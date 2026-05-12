import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { EntretienTypeCode } from '@prisma/client';
import {
  EntretienTypeCode as EntretienTypeCodeEnum,
  HlmTicketCategory,
  HlmTicketStatus,
  HlmTicketUrgency,
  MaintenanceFrequency,
} from '@prisma/client';

/** POST /hlm/residences */
export class CreateResidenceRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  bailleurId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '2024-06-15' })
  @IsDateString()
  deliveryDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  constructionYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  residenceNeuve?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasInternalGPAServicePerResidence?: boolean;
}

/** PATCH /hlm/residences/:id */
export class UpdateResidenceRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  constructionYear?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  residenceNeuve?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasInternalGPAServicePerResidence?: boolean;
}

/** POST /hlm/logements */
export class CreateLogementRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  residenceId!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasVmc?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasSolarWaterHeater?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasCour?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasJardin?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasTerrasse?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasPatio?: boolean;
}

/** PATCH /hlm/logements/:id */
export class UpdateLogementRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasVmc?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasSolarWaterHeater?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasCour?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasJardin?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasTerrasse?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasPatio?: boolean;
}

/** PATCH .../assign-locataire */
export class AssignLocataireRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locataireId!: string;
}

/** POST /hlm/entretien/types */
export class CreateEntretienTypeRequestDto {
  @ApiProperty({ enum: EntretienTypeCodeEnum })
  @IsEnum(EntretienTypeCodeEnum)
  code!: EntretienTypeCode;

  @ApiProperty()
  @IsString()
  labelFr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ enum: MaintenanceFrequency })
  @IsEnum(MaintenanceFrequency)
  frequency!: MaintenanceFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresOutdoorContext?: boolean;
}

/** POST /hlm/preuves/:logementEntretienId */
export class SubmitProofRequestDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  checklist!: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  photo1Url!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  photo2Url!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locataireId?: string | null;
}

/** PATCH validate-landlord */
export class ValidateLandlordRequestDto {
  @ApiProperty()
  @IsBoolean()
  accepted!: boolean;
}

/** PATCH validate-ai */
export class ValidateAiRequestDto {
  @ApiProperty()
  @IsBoolean()
  accepted!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  confidence?: number | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}

/** POST /hlm/tickets */
export class CreateHlmTicketRequestDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ enum: HlmTicketCategory })
  @IsEnum(HlmTicketCategory)
  category!: HlmTicketCategory;

  @ApiPropertyOptional({ enum: HlmTicketUrgency })
  @IsOptional()
  @IsEnum(HlmTicketUrgency)
  urgency?: HlmTicketUrgency;

  @ApiPropertyOptional({ enum: HlmTicketStatus })
  @IsOptional()
  @IsEnum(HlmTicketStatus)
  status?: HlmTicketStatus;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  logementId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locataireId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  routingNotes?: string | null;
}
