import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class AssignTenantDto {
  @IsInt()
  housingId: number;

  /** Identifiant utilisateur (User.id) du locataire */
  @IsInt()
  tenantId: number;

  /** Date de l'état des lieux de sortie de l'ancien logement (si déménagement). */
  @IsOptional()
  @IsDateString()
  moveOutDate?: string;

  /** Date d'entrée dans le nouveau logement (défaut = moveOutDate ou maintenant). */
  @IsOptional()
  @IsDateString()
  moveInDate?: string;
}
