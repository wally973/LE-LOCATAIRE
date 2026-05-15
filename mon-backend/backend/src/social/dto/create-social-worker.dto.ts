import { IsIn, IsInt, IsString } from 'class-validator';

/**
 * Enregistrement d'un référent social rattaché au bailleur (utilisateur existant — P6).
 */
export class CreateSocialWorkerDto {
  @IsInt()
  userId!: number;

  @IsString()
  @IsIn(['COORDINATOR', 'FIELD', 'EXTERNAL'])
  role!: string;
}
