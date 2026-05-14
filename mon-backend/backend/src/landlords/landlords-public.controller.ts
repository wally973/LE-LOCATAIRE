import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Endpoints publics (sans JWT) relatifs aux bailleurs.
 *
 * Sert au flow d'onboarding self-service du locataire : il doit pouvoir
 * récupérer la liste des bailleurs partenaires AVANT d'avoir un compte
 * pour pouvoir en choisir un au moment de son inscription.
 */
@ApiTags('landlords-public')
@Controller('landlords/public')
export class LandlordsPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste publique des bailleurs partenaires (pour onboarding locataire)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tableau ordonné alphabétiquement (id, name, logoUrl)',
  })
  list() {
    return this.prisma.landlordProfile.findMany({
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
