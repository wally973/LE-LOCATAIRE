import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiRoutingService } from './ai-routing.service';
import { TenantFeedbackDto } from './dto/tenant-feedback.dto';
import { parseIntakeState } from '../lia/lia-intake.service';
import { LiaOrchestratorService } from '../lia/lia-orchestrator.service';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../feature-flags/landlord-module.guard';

/**
 * Endpoints autour du routage IA d'un ticket.
 * - redo-photo / tenant-feedback : relance le pipeline IA après action locataire
 * - request-human-review : sort un ticket AUTO_CLOSED vers une revue humaine
 * - ai-analyze (admin) : outil de debug pour rejouer le pipeline
 */
@ApiTags('ai-routing')
@ApiBearerAuth('bearer')
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard, LandlordModuleGuard)
@RequiresLandlordModule('aiRoutingModule')
export class AiRoutingController {
  constructor(
    private readonly aiRouting: AiRoutingService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LiaOrchestratorService))
    private readonly liaOrchestrator: LiaOrchestratorService,
  ) {}

  /**
   * Le locataire vient de re-uploader une photo ; on relance le pipeline.
   */
  @Post(':id/redo-photo')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary: 'Relancer l’analyse IA après ajout d’une nouvelle photo',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket mis à jour avec la nouvelle décision IA',
  })
  async redoPhoto(
    @Req() req,
    @Param('id', ParseIntPipe) ticketId: number,
    @Body() dto: TenantFeedbackDto,
  ) {
    await this.assertTenantOwnsTicket(req.user.id, ticketId);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { aiLastDecision: true },
    });
    const intake = parseIntakeState(ticket?.aiLastDecision);

    if (intake?.phase === 'AWAITING_PHOTO' && dto.photoUrl) {
      await this.liaOrchestrator.onPhotoUploaded(
        ticketId,
        req.user.id,
        dto.photoUrl,
        dto.feedback,
      );
      return this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          housing: { include: { landlord: { include: { user: true } } } },
          tenant: { include: { user: true } },
          documents: true,
        },
      });
    }

    return this.aiRouting.analyzeTicket(ticketId, {
      tenantFeedback: dto.feedback,
      photoUrl: dto.photoUrl,
      force: true,
    });
  }

  /**
   * Le locataire répond à une question du pipeline (sans photo) → re-analyse.
   */
  @Post(':id/tenant-feedback')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary: 'Envoyer une précision textuelle pour relancer l’IA',
  })
  async tenantFeedback(
    @Req() req,
    @Param('id', ParseIntPipe) ticketId: number,
    @Body() dto: TenantFeedbackDto,
  ) {
    if (!dto.feedback || dto.feedback.trim().length < 3) {
      throw new BadRequestException(
        'Merci de préciser votre demande en quelques mots.',
      );
    }
    await this.assertTenantOwnsTicket(req.user.id, ticketId);
    return this.aiRouting.analyzeTicket(ticketId, {
      tenantFeedback: dto.feedback,
      force: true,
    });
  }

  /**
   * P2 : revue humaine demandée par le locataire après AUTO_CLOSED.
   */
  @Post(':id/request-human-review')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary:
      'Demander une revue humaine après une fermeture automatique de l’IA',
  })
  async requestHumanReview(
    @Req() req,
    @Param('id', ParseIntPipe) ticketId: number,
  ) {
    return this.aiRouting.requestHumanReview(ticketId, req.user.id);
  }

  /**
   * Admin/Bailleur : relance manuelle du pipeline (debug, audit, simulation).
   */
  @Post(':id/ai-analyze')
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({
    summary:
      'Forcer la ré-exécution du pipeline IA sur un ticket (debug / audit)',
  })
  async forceAnalyze(@Param('id', ParseIntPipe) ticketId: number) {
    return this.aiRouting.analyzeTicket(ticketId, { force: true });
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async assertTenantOwnsTicket(userId: number, ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { tenant: true },
    });
    if (!ticket) throw new BadRequestException('Ticket introuvable');
    if (ticket.tenant.userId !== userId) {
      throw new ForbiddenException('Ce ticket ne vous appartient pas.');
    }
  }
}
