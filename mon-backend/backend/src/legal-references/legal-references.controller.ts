import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LegalReferencesService } from './legal-references.service';

/**
 * Catalogue juridique locatif (lecture seule).
 * Accessible sans authentification pour permettre la sync / consultation offline.
 */
@ApiTags('legal-references')
@Controller('legal-references')
export class LegalReferencesController {
  constructor(private readonly legalRefs: LegalReferencesService) {}

  @Get('version')
  @ApiOperation({ summary: 'Version du catalogue (sync mobile)' })
  getVersion() {
    return this.legalRefs.getVersionMeta();
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Catalogue juridique complet (JSON)' })
  getCatalog() {
    return this.legalRefs.getCatalog();
  }

  @Get('search')
  @ApiOperation({ summary: 'Recherche par mots-clés dans le catalogue' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'limit', required: false })
  search(
    @Query('q') q: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.legalRefs.search({
      query: q ?? '',
      category,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
