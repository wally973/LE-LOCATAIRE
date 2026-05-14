import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body du feedback locataire — utilisé sur /tickets/:id/tenant-feedback
 * et /tickets/:id/redo-photo. Tout est optionnel : juste l'appel suffit
 * à relancer le pipeline.
 */
export class TenantFeedbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
