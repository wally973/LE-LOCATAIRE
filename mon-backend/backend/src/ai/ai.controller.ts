import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiPhotoService } from './ai-photo.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyzePhotoDto } from './dto/analyze-photo.dto';

@ApiTags('ai')
@ApiBearerAuth('bearer')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiPhoto: AiPhotoService,
  ) {}

  @Post('ticket-flow')
  @Roles('LOCATAIRE')
  async handleTicketFlow(@Body() body: Record<string, any>) {
    if (body.description) {
      return {
        next: 'START_CONVERSATION',
        message:
          'Utilisez la création de ticket : Lia vous posera des questions avant la photo et le diagnostic.',
      };
    }

    if (body.photoUrl) {
      const diagnostic = await this.aiPhoto.analyzePhoto(body.photoUrl, {
        title: typeof body.title === 'string' ? body.title : undefined,
        description:
          typeof body.description === 'string' ? body.description : undefined,
        ticketId:
          typeof body.ticketId === 'number' ? body.ticketId : undefined,
      });
      return {
        next: 'READY_TO_CREATE_TICKET',
        diagnostic,
      };
    }

    return { status: 'initialized' };
  }

  @Post('analyze-photo')
  @Roles('LOCATAIRE', 'ADMIN', 'BAILLEUR', 'PRESTATAIRE')
  analyzePhoto(@Body() dto: AnalyzePhotoDto) {
    return this.aiService.analyzePhoto(dto);
  }
}
