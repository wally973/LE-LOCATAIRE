import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';
import { AdminUpdateLandlordDto, CreateLandlordDto } from './dto/landlord.dto';
import {
  AdminUserListQueryDto,
  AuditLogQueryDto,
  HousingListQueryDto,
} from './dto/list-query.dto';
import { SetUserAvailabilityDto } from './dto/set-availability.dto';
import { PaginationMetaDto } from './dto/pagination-response.dto';
import type { AdminActor } from './admin.service';

/**
 * API réservée aux utilisateurs avec le rôle ADMIN (JWT + RolesGuard).
 */
@ApiTags('admin')
@ApiBearerAuth('bearer')
@ApiExtraModels(PaginationMetaDto)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('admins')
  @ApiOperation({ summary: 'Créer un administrateur' })
  @ApiResponse({ status: 201, description: 'Admin créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email ou téléphone déjà utilisé' })
  createAdmin(
    @Body() dto: CreateAdminDto,
    @CurrentUser() user: AdminActor,
  ) {
    return this.adminService.createAdmin(dto, user);
  }

  @Get('admins')
  @ApiOperation({
    summary: 'Lister les administrateurs (pagination, recherche, statut)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'active', 'inactive'],
  })
  @ApiResponse({ status: 200, description: 'Liste paginée' })
  getAdmins(@Query() query: AdminUserListQueryDto) {
    return this.adminService.listAdmins(query);
  }

  @Get('admins/:id')
  @ApiOperation({ summary: 'Détail d’un administrateur' })
  @ApiResponse({ status: 200, description: 'Admin trouvé' })
  @ApiResponse({ status: 404, description: 'Admin introuvable' })
  getAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAdminById(id);
  }

  @Post('landlords')
  @ApiOperation({ summary: 'Créer un bailleur' })
  @ApiResponse({ status: 201, description: 'Bailleur créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email ou téléphone déjà utilisé' })
  createLandlord(
    @Body() dto: CreateLandlordDto,
    @CurrentUser() user: AdminActor,
  ) {
    return this.adminService.createLandlord(dto, user);
  }

  @Get('landlords')
  @ApiOperation({
    summary: 'Lister les bailleurs (pagination, recherche sur nom email téléphone, statut)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'active', 'inactive'],
  })
  @ApiResponse({ status: 200, description: 'Liste paginée' })
  getLandlords(@Query() query: AdminUserListQueryDto) {
    return this.adminService.listLandlords(query);
  }

  @Get('landlords/:id')
  @ApiOperation({ summary: 'Détail bailleur et logements' })
  @ApiResponse({ status: 200, description: 'Bailleur et logements' })
  @ApiResponse({ status: 404, description: 'Bailleur introuvable' })
  getLandlordWithHousings(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getLandlordById(id);
  }

  @Get('housings')
  @ApiOperation({
    summary: 'Lister les logements (pagination, recherche adresse / CP, occupation)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'occupancy',
    required: false,
    enum: ['all', 'occupied', 'vacant'],
  })
  @ApiResponse({ status: 200, description: 'Liste paginée' })
  getHousings(@Query() query: HousingListQueryDto) {
    return this.adminService.listHousings(query);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Journal d’audit (actions administrateur)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'actorId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Entrées paginées' })
  getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.adminService.listAuditLogs(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques globales agrégées' })
  @ApiResponse({ status: 200, description: 'Statistiques calculées' })
  getStats() {
    return this.adminService.getStats();
  }

  @Patch('admins/:id')
  @ApiOperation({ summary: 'Modifier un administrateur' })
  @ApiResponse({ status: 200, description: 'Admin modifié avec succès' })
  @ApiResponse({ status: 404, description: 'Admin introuvable' })
  @ApiResponse({ status: 409, description: 'Email ou téléphone déjà utilisé' })
  updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminDto,
    @CurrentUser() user: AdminActor,
  ) {
    return this.adminService.updateAdmin(id, dto, user);
  }

  @Delete('admins/:id')
  @ApiOperation({ summary: 'Supprimer définitivement un administrateur' })
  @ApiResponse({ status: 200, description: 'Admin supprimé avec succès' })
  @ApiResponse({ status: 403, description: 'Suppression de son propre compte interdite' })
  @ApiResponse({ status: 404, description: 'Admin introuvable' })
  deleteAdmin(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AdminActor,
  ) {
    return this.adminService.deleteAdmin(id, user);
  }

  @Patch('landlords/:id')
  @ApiOperation({ summary: 'Modifier un bailleur' })
  @ApiResponse({ status: 200, description: 'Bailleur modifié avec succès' })
  @ApiResponse({ status: 404, description: 'Bailleur introuvable' })
  @ApiResponse({ status: 409, description: 'Email ou téléphone déjà utilisé' })
  updateLandlord(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateLandlordDto,
    @CurrentUser() user: AdminActor,
  ) {
    return this.adminService.updateLandlord(id, dto, user);
  }

  @Delete('landlords/:id')
  @ApiOperation({ summary: 'Supprimer un bailleur et son profil bailleur' })
  @ApiResponse({ status: 200, description: 'Bailleur supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Bailleur introuvable' })
  deleteLandlord(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AdminActor,
  ) {
    return this.adminService.deleteLandlord(id, user);
  }

  @Patch('users/:id/availability')
  @ApiOperation({
    summary: 'Activer ou désactiver un utilisateur (soft delete)',
  })
  @ApiResponse({ status: 200, description: 'Disponibilité mise à jour' })
  @ApiResponse({ status: 403, description: 'Interdit (ex. auto-désactivation)' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  setUserAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetUserAvailabilityDto,
    @CurrentUser() user: AdminActor,
  ) {
    return this.adminService.setUserAvailability(id, dto, user);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Données tableau de bord (stats, tendances 7 jours, listes récentes)',
  })
  @ApiResponse({ status: 200, description: 'Données agrégées du dashboard' })
  getDashboard() {
    return this.adminService.getDashboardStats();
  }
}
