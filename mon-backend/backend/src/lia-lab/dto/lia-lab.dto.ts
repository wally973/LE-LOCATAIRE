import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const LAB_LANGUAGES = ['fr', 'gcf', 'en', 'pt', 'es', 'hat'] as const;
const LAB_AGE_BANDS = ['senior', 'adult', 'young', 'unknown'] as const;
const LAB_INTERLOCUTOR_ROLES = ['tenant', 'staff_tester'] as const;

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

  /** Langue choisie par le locataire (pas de détection auto). */
  @IsOptional()
  @IsIn(LAB_LANGUAGES)
  language?: (typeof LAB_LANGUAGES)[number];

  /** Lot locataire (inscription) — ex. 5F = collectif, 26 = plein pied */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  residenceUnitNumber?: string;

  /** Profil social — miroir relationnel Groq (ex. senior → ton protecteur). */
  @IsOptional()
  @IsIn(LAB_AGE_BANDS)
  tenantAgeBand?: (typeof LAB_AGE_BANDS)[number];

  @IsOptional()
  @IsIn(LAB_INTERLOCUTOR_ROLES)
  interlocutorRole?: (typeof LAB_INTERLOCUTOR_ROLES)[number];

  /** Suite d’un dossier clos — continuité réparation (pas de faux accueil). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lastClosedTicketSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lastClosedTicketTitle?: string;
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
  @IsIn(LAB_LANGUAGES)
  language?: (typeof LAB_LANGUAGES)[number];
}
