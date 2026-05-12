import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { HlmIAService } from './hlm-ia.service';

/**
 * IA — analyse preuves / diagnostic / routage (stubs branchables ML).
 * Préfixe : `/hlm/ia`
 */
@ApiTags('hlm-ia')
@ApiBearerAuth('bearer')
@Controller('hlm/ia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HlmIAController {
  constructor(private readonly iaService: HlmIAService) {}

  @Post('analyze-image/:preuveId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lancer une analyse image sur une preuve d’entretien' })
  analyzeImage(@Param('preuveId', ParseUUIDPipe) preuveId: string) {
    return this.iaService.analyzeImage(preuveId);
  }

  @Post('diagnostic/:ticketId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Enregistrer un diagnostic IA pour un ticket HLM' })
  diagnostic(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.iaService.diagnosticTicket(ticketId);
  }

  @Post('route/:ticketId')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Calculer et persister une proposition de routage IA (réutilise routeTicket)',
  })
  route(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.iaService.computeRouting(ticketId);
  }
}
