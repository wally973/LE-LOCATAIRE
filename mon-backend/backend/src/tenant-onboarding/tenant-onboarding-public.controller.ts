import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

/**
 * Endpoint public d'inscription self-service du locataire.
 * Aucune authentification : le locataire n'a pas encore de compte.
 */
@ApiTags('tenant-onboarding')
@Controller('auth')
export class TenantOnboardingPublicController {
  constructor(private readonly service: TenantOnboardingService) {}

  @Post('register-tenant')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Inscription self-service locataire (saisie infos + choix bailleur, attente validation)',
  })
  @ApiResponse({
    status: 201,
    description: 'Demande enregistrée, compte en attente de validation bailleur',
  })
  @ApiResponse({ status: 400, description: 'Bailleur introuvable ou données invalides' })
  @ApiResponse({ status: 409, description: 'Email ou téléphone déjà utilisé' })
  registerTenant(@Body() dto: RegisterTenantDto) {
    return this.service.registerTenant(dto);
  }
}
