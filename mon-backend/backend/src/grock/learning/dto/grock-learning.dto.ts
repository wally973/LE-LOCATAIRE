import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const GROCK_APPLIES_TO = [
  'CARPENTRY_LOCK',
  'PLUMBING_WATER',
  'HUMIDITY_ENVELOPE',
  'ELECTRICITY',
  'GENERAL',
  'ALL',
] as const;

/** Leçon arbitrée par l'Architecte à partir d'un cas détecté. */
export class ProposeLessonDto {
  @IsString()
  @MaxLength(80)
  id!: string;

  @IsArray()
  @IsIn(GROCK_APPLIES_TO, { each: true })
  appliesTo!: Array<(typeof GROCK_APPLIES_TO)[number]>;

  @IsString()
  @MaxLength(600)
  principle!: string;

  @IsString()
  @MaxLength(1000)
  reasoningShift!: string;

  @IsString()
  @MaxLength(1000)
  thinkingInstruction!: string;

  @IsString()
  @MaxLength(1000)
  acknowledgmentInstruction!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  examples?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sourceKind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourcePhotoHash?: string;
}

/** Dialogue Architecte ↔ Grock (même moteur cognitif). */
export class ConverseGrockDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}
