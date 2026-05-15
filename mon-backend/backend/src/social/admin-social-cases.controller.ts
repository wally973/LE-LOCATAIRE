import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SocialCaseCategory, SocialCaseStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SocialCasesService } from './social-cases.service';
import { UpdateSocialCaseDto } from './dto/update-social-case.dto';

/**
 * Backoffice administrateur — tous les dossiers sociaux (tous bailleurs).
 */
@ApiTags('admin-social-cases')
@ApiBearerAuth('bearer')
@Controller('admin/social-cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminSocialCasesController {
  constructor(private readonly socialCases: SocialCasesService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lister les dossiers sociaux (filtres optionnels)' })
  @ApiQuery({ name: 'bailleurId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: SocialCaseStatus })
  @ApiQuery({ name: 'category', required: false, enum: SocialCaseCategory })
  list(
    @Query('bailleurId') bailleurId?: string,
    @Query('status') status?: SocialCaseStatus,
    @Query('category') category?: SocialCaseCategory,
  ) {
    return this.socialCases.listForAdmin({
      bailleurId: bailleurId ? parseInt(bailleurId, 10) : undefined,
      status,
      category,
    });
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Détail d’un dossier social' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.socialCases.findOneForAdmin(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mettre à jour un dossier social (admin)' })
  patch(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSocialCaseDto,
  ) {
    return this.socialCases.updateForAdmin(id, dto, req.user.id);
  }
}
