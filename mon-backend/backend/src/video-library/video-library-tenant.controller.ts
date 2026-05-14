import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { VideoLibraryService } from './video-library.service';
import { VideoFeedbackDto } from './dto/video-feedback.dto';

/**
 * Endpoints locataire autour de la vidéothèque tutoriels.
 * Tous protégés par JWT + RolesGuard (rôle LOCATAIRE).
 */
@ApiTags('video-library')
@ApiBearerAuth('bearer')
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VideoLibraryTenantController {
  constructor(private readonly videoLibrary: VideoLibraryService) {}

  @Get(':id/videos')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary: 'Lister les vidéos tutoriels proposées par l’IA pour ce ticket',
  })
  @ApiResponse({
    status: 200,
    description:
      'Liste des TicketVideoSuggestion avec la vidéo embarquée et le feedback locataire',
  })
  getSuggestions(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.videoLibrary.getSuggestionsForTicket(req.user.id, id);
  }

  @Post(':id/videos/:suggestionId/feedback')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary: 'Envoyer un retour locataire sur une vidéo proposée',
  })
  submitFeedback(
    @Req() req,
    @Param('id', ParseIntPipe) ticketId: number,
    @Param('suggestionId', ParseIntPipe) suggestionId: number,
    @Body() dto: VideoFeedbackDto,
  ) {
    return this.videoLibrary.submitFeedback(
      req.user.id,
      ticketId,
      suggestionId,
      dto,
    );
  }

  @Post(':id/mark-resolved-by-video')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary:
      'Clôturer un ticket à votre charge après avoir résolu grâce à un tutoriel',
  })
  markResolvedByVideo(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.videoLibrary.markResolvedByVideo(req.user.id, id);
  }
}
