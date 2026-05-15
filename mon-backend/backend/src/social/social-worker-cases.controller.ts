import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { SocialCasesService } from './social-cases.service';
import { SocialWorkerGuard } from './social-worker.guard';
import { SocialWorkerCtx } from './social-worker.decorator';
import { UpdateSocialCaseDto } from './dto/update-social-case.dto';

type SwCtx = { id: number; bailleurId: number };

/**
 * Référent social — dossiers assignés uniquement (Sprint 5 P1 / P2).
 */
@ApiTags('social-worker-cases')
@ApiBearerAuth('bearer')
@Controller('social/me/cases')
@UseGuards(JwtAuthGuard, SocialWorkerGuard)
export class SocialWorkerCasesController {
  constructor(private readonly socialCases: SocialCasesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister mes dossiers sociaux assignés' })
  list(@SocialWorkerCtx() sw: SwCtx) {
    return this.socialCases.listForAssignedWorker(sw.id, sw.bailleurId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un dossier qui m’est assigné' })
  detail(@SocialWorkerCtx() sw: SwCtx, @Param('id', ParseIntPipe) id: number) {
    return this.socialCases.findOneForSocialWorker(id, sw);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un dossier qui m’est assigné' })
  patch(
    @Req() req,
    @SocialWorkerCtx() sw: SwCtx,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSocialCaseDto,
  ) {
    return this.socialCases.updateForWorker(id, dto, sw, req.user.id);
  }
}
