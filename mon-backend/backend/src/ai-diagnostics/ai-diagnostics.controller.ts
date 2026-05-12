import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { AiDiagnosticsService } from './ai-diagnostics.service';
import { RecordAiDiagnosticDto } from './dto/record-ai-diagnostic.dto';

@ApiTags('ai-diagnostics')
@ApiBearerAuth('bearer')
@Controller('ai-diagnostics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiDiagnosticsController {
  constructor(private readonly svc: AiDiagnosticsService) {}

  /**
   * Enregistrement anonymisé d’un passage pipeline IA (sans texte brut utilisateur).
   */
  @Post('record')
  @Roles('LOCATAIRE', 'BAILLEUR', 'ADMIN', 'PRESTATAIRE')
  @ApiOperation({ summary: 'Journaliser une exécution pipeline IA (RGPD-safe)' })
  record(
    @CurrentUser() user: { userId: number },
    @Body() dto: RecordAiDiagnosticDto,
  ) {
    return this.svc.record(user.userId, dto);
  }
}
