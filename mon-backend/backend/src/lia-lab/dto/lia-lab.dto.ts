import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLabSessionDto {
  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenantFirstName?: string;
}

export class LabMessageDto {
  @IsString()
  @MaxLength(4000)
  text!: string;
}

export class LabTtsDto {
  @IsString()
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsString()
  language?: 'fr' | 'gcf';
}
