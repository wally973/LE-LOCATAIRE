import { Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiDiagnosticsService } from './ai-diagnostics.service';

@ApiTags('admin-ai-diagnostics')
@ApiBearerAuth('bearer')
@Controller('admin/ai-diagnostics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminAiDiagnosticsController {
  constructor(private readonly svc: AiDiagnosticsService) {}

  @Get('stats')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Statistiques IA (30 derniers jours)' })
  stats() {
    return this.svc.getStatsForDashboard();
  }

  @Post('purge')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Purge RGPD (> N jours, défaut 30)' })
  purge(@Query('days') days?: string) {
    const n = Math.min(Math.max(parseInt(days ?? '30', 10) || 30, 1), 365);
    return this.svc.purgeOlderThanDays(n);
  }

  /** Destruction données IA pour tous les utilisateurs (opération maintenance). */
  @Delete('purge-all')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Vider toute la table (attention)' })
  purgeAll() {
    return this.svc.purgeAll();
  }
}
