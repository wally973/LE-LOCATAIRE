import { IsBoolean, IsOptional } from 'class-validator';
import { LANDLORD_MODULE_KEYS } from '../feature-flags.types';

/** PATCH partiel — chaque module est optionnel. */
export class UpdateFeatureFlagsDto {
  @IsOptional()
  @IsBoolean()
  ticketsModule?: boolean;

  @IsOptional()
  @IsBoolean()
  tenantOnboardingModule?: boolean;

  @IsOptional()
  @IsBoolean()
  aiRoutingModule?: boolean;

  @IsOptional()
  @IsBoolean()
  videoLibraryModule?: boolean;

  @IsOptional()
  @IsBoolean()
  artisanRequestsModule?: boolean;

  @IsOptional()
  @IsBoolean()
  socialModule?: boolean;

  @IsOptional()
  @IsBoolean()
  hlmModule?: boolean;

  @IsOptional()
  @IsBoolean()
  contratsModule?: boolean;

  @IsOptional()
  @IsBoolean()
  paiementsModule?: boolean;
}

export const FEATURE_FLAG_KEYS = LANDLORD_MODULE_KEYS;
