import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { VideoLibraryService } from './video-library.service';

/**
 * Body de modération admin sur une vidéo. Champs facultatifs pour ne mettre
 * à jour que ce qui est fourni.
 */
class ModerationDto {
  @IsOptional()
  @IsBoolean()
  validatedByAdmin?: boolean;

  @IsOptional()
  @IsBoolean()
  disabledByAdmin?: boolean;
}

/**
 * Backoffice admin de la vidéothèque IA.
 * Réservé au rôle ADMIN (owner de la plateforme).
 */
@ApiTags('admin-video-library')
@ApiBearerAuth('bearer')
@Controller('admin/video-library')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VideoLibraryAdminController {
  constructor(private readonly videoLibrary: VideoLibraryService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Lister toutes les recherches vidéos archivées + leurs vidéos',
  })
  list() {
    return this.videoLibrary.listLibrary();
  }

  @Patch('videos/:id')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Modérer une vidéo : validatedByAdmin (boost) et/ou disabledByAdmin (blacklist)',
  })
  moderate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModerationDto,
  ) {
    return this.videoLibrary.updateVideoModeration(id, dto);
  }
}
