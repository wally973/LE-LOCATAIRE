import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SocialCasesService } from './social-cases.service';

/**
 * Locataire — vue limitée du dossier social actif (P3).
 */
@ApiTags('tenant-social-case')
@ApiBearerAuth('bearer')
@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantSocialCaseController {
  constructor(private readonly socialCases: SocialCasesService) {}

  @Get('me/social-case')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary: 'Consulter mon dossier social ouvert ou en suivi (sans notes internes)',
  })
  getActive(@Req() req: { user: { id: number } }) {
    return this.socialCases.getActiveCaseForTenant(req.user.id);
  }
}
