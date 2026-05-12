import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Filtre actif / désactivé pour les listes utilisateurs */
export enum UserStatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** Filtre occupation pour les logements */
export enum HousingOccupancyFilter {
  ALL = 'all',
  OCCUPIED = 'occupied',
  VACANT = 'vacant',
}

/**
 * Paramètres de liste paginée pour les admins et bailleurs (recherche + statut).
 */
export class AdminUserListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Recherche sur email, téléphone et nom du bailleur (liste bailleurs uniquement)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserStatusFilter, default: UserStatusFilter.ALL })
  @IsOptional()
  @IsEnum(UserStatusFilter)
  status?: UserStatusFilter = UserStatusFilter.ALL;
}

/**
 * Liste des logements avec pagination et filtres métier.
 */
export class HousingListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Adresse ou ville (recherche partielle)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: HousingOccupancyFilter,
    default: HousingOccupancyFilter.ALL,
  })
  @IsOptional()
  @IsEnum(HousingOccupancyFilter)
  occupancy?: HousingOccupancyFilter = HousingOccupancyFilter.ALL;
}

/**
 * Consultation paginée du journal d’audit.
 */
export class AuditLogQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Filtre texte sur action ou type d’entité' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrer par ID acteur' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actorId?: number;
}
