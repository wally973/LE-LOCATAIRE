import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { AiDiagnosticsService } from '../ai-diagnostics/ai-diagnostics.service';

@ApiTags('tenant')
@ApiBearerAuth('bearer')
@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly aiDiagnostics: AiDiagnosticsService,
  ) {}

  @Get('me')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Profil locataire + logement courant' })
  getMe(@CurrentUser() user: { userId: number }) {
    return this.tenantService.getProfile(user.userId);
  }

  @Patch('me')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Mettre à jour profil / mot de passe' })
  updateMe(
    @CurrentUser() user: { userId: number },
    @Body() dto: UpdateTenantProfileDto,
  ) {
    return this.tenantService.updateProfile(user.userId, dto);
  }

  @Get('me/dashboard')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Synthèse dashboard locataire' })
  getDashboard(@CurrentUser() user: { userId: number }) {
    return this.tenantService.getDashboard(user.userId);
  }

  /** Quittances / pièces comptables liées au locataire (lecture) */
  @Get('me/payments')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Liste des paiements / quittances disponibles' })
  listMyPayments(@CurrentUser() user: { userId: number }) {
    return this.tenantService.listMyPayments(user.userId);
  }

  @Get('me/payments/:documentId')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Détail d\'une quittance (document associé)' })
  getPaymentDetail(
    @CurrentUser() user: { userId: number },
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.tenantService.getMyPaymentDetail(user.userId, documentId);
  }

  @Delete('me/ai-diagnostics')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary: 'Supprimer l’historique IA anonymisé lié au compte',
  })
  deleteMyAiHistory(@CurrentUser() user: { userId: number }) {
    return this.aiDiagnostics.deleteByUserId(user.userId);
  }
}
