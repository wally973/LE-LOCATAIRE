import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GrockLearningService } from './grock-learning.service';
import { ProposeLessonDto } from './dto/grock-learning.dto';

/**
 * Boucle d'apprentissage Grock — arbitrage humain (étage 3, ADMIN).
 * Liste les cas détectés par les sondes et pilote le cycle de doctrine
 * (proposer une leçon `draft` → signer `validated` → rejeter).
 */
@ApiTags('grock-learning')
@ApiBearerAuth()
@Controller('grock-learning')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class GrockLearningController {
  constructor(private readonly learning: GrockLearningService) {}

  @Get('candidates')
  candidates(@Query('limit') limit?: string) {
    const n = Number(limit);
    return this.learning.listCandidates(Number.isFinite(n) && n > 0 ? n : 500);
  }

  @Get('lessons')
  lessons(@Query('status') status?: 'draft' | 'validated') {
    return this.learning.listLessons(status);
  }

  @Post('lessons')
  propose(@Body() dto: ProposeLessonDto) {
    return {
      lesson: this.learning.proposeLesson({
        id: dto.id,
        appliesTo: dto.appliesTo,
        principle: dto.principle,
        reasoningShift: dto.reasoningShift,
        thinkingInstruction: dto.thinkingInstruction,
        acknowledgmentInstruction: dto.acknowledgmentInstruction,
        examples: dto.examples,
        sourceCandidate: dto.sourceKind
          ? { kind: dto.sourceKind, photoHash: dto.sourcePhotoHash ?? null }
          : undefined,
      }),
    };
  }

  @Post('lessons/:id/sign')
  sign(@Param('id') id: string, @Req() req: { user?: { email?: string } }) {
    const signataire = req.user?.email?.trim() || 'architecte';
    return { lesson: this.learning.signLesson(id, signataire) };
  }

  @Delete('lessons/:id')
  reject(@Param('id') id: string) {
    return this.learning.rejectLesson(id);
  }
}
