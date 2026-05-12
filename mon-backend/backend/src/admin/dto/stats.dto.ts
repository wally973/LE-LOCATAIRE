import { ApiProperty } from '@nestjs/swagger';

export class StatsResponseDto {
  @ApiProperty({ description: 'Nombre total d\'admins' })
  totalAdmins: number;

  @ApiProperty({ description: 'Nombre total de bailleurs' })
  totalLandlords: number;

  @ApiProperty({ description: 'Nombre total de locataires' })
  totalTenants: number;

  @ApiProperty({ description: 'Nombre total de logements' })
  totalHousings: number;

  @ApiProperty({ description: 'Nombre de logements occupés' })
  occupiedHousings: number;

  @ApiProperty({ description: 'Nombre de logements vacants' })
  vacantHousings: number;

  @ApiProperty({ description: 'Nombre de tickets ouverts' })
  ticketsOpen: number;

  @ApiProperty({ description: 'Nombre de tickets résolus' })
  ticketsResolved: number;
}
