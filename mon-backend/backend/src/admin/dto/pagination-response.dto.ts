import { ApiProperty } from '@nestjs/swagger';

/** Métadonnées communes aux réponses paginées. */
export class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
