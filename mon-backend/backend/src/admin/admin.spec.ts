import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/admin.dto';
import { CreateLandlordDto } from './dto/landlord.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guard/roles.guard';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserStatusFilter } from './dto/list-query.dto';

/** Acteur minimal pour les mutations auditées */
const actor = { id: 1, userId: 1, email: 'admin@test.com' };

describe('AdminModule', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    landlordProfile: {
      deleteMany: jest.fn(),
    },
    housing: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
    mockPrismaService.adminAuditLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin Management', () => {
    describe('createAdmin', () => {
      it('should create a new admin', async () => {
        const createAdminDto: CreateAdminDto = {
          email: 'admin@example.com',
          phone: '+33612345678',
          password: 'password123',
        };

        const mockAdmin = {
          id: 1,
          email: 'admin@example.com',
          phone: '+33612345678',
          role: 'ADMIN',
          createdAt: new Date(),
          isAvailable: true,
        };

        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue(mockAdmin);

        const result = await service.createAdmin(createAdminDto, actor);

        expect(result).toEqual(mockAdmin);
        expect(mockPrismaService.user.create).toHaveBeenCalled();
        expect(mockPrismaService.adminAuditLog.create).toHaveBeenCalled();
      });

      it('should throw ConflictException if email already exists', async () => {
        const createAdminDto: CreateAdminDto = {
          email: 'existing@example.com',
          phone: '+33612345678',
          password: 'password123',
        };

        mockPrismaService.user.findFirst.mockResolvedValue({
          id: 1,
          email: 'existing@example.com',
        });

        await expect(service.createAdmin(createAdminDto, actor)).rejects.toThrow(
          ConflictException,
        );
      });
    });

    describe('listAdmins', () => {
      it('should return paginated admins', async () => {
        const mockAdmins = [
          { id: 1, email: 'admin1@example.com', role: 'ADMIN' },
        ];

        mockPrismaService.user.findMany.mockResolvedValue(mockAdmins);
        mockPrismaService.user.count.mockResolvedValue(1);

        const result = await service.listAdmins({
          page: 1,
          limit: 20,
        });

        expect(result.data).toEqual(mockAdmins);
        expect(result.meta.total).toBe(1);
        expect(result.meta.page).toBe(1);
        expect(mockPrismaService.user.findMany).toHaveBeenCalled();
      });

      it('should filter inactive admins when status inactive', async () => {
        mockPrismaService.user.findMany.mockResolvedValue([]);
        mockPrismaService.user.count.mockResolvedValue(0);

        await service.listAdmins({
          page: 1,
          limit: 10,
          status: UserStatusFilter.INACTIVE,
        });

        expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ isAvailable: false }),
          }),
        );
      });
    });

    describe('getAdminById', () => {
      it('should return admin by id', async () => {
        const mockAdmin = {
          id: 1,
          email: 'admin@example.com',
          role: 'ADMIN',
        };

        mockPrismaService.user.findFirst.mockResolvedValue(mockAdmin);

        const result = await service.getAdminById(1);

        expect(result).toEqual(mockAdmin);
      });

      it('should throw NotFoundException if admin not found', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(null);

        await expect(service.getAdminById(999)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('deleteAdmin', () => {
      it('should forbid deleting own account', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue({
          id: 1,
          role: 'ADMIN',
        });

        await expect(service.deleteAdmin(1, actor)).rejects.toThrow(
          ForbiddenException,
        );
      });
    });
  });

  describe('Landlord Management', () => {
    describe('createLandlord', () => {
      it('should create a new landlord', async () => {
        const createLandlordDto: CreateLandlordDto = {
          email: 'landlord@example.com',
          phone: '+33612345679',
          password: 'password123',
          name: 'John Landlord',
        };

        const mockLandlord = {
          id: 1,
          email: 'landlord@example.com',
          role: 'BAILLEUR',
          isAvailable: true,
          landlord: {
            id: 1,
            name: 'John Landlord',
            logoUrl: null,
          },
        };

        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue(mockLandlord);

        const result = await service.createLandlord(createLandlordDto, actor);

        expect(result).toEqual(mockLandlord);
        expect(mockPrismaService.adminAuditLog.create).toHaveBeenCalled();
      });
    });

    describe('listLandlords', () => {
      it('should return paginated landlords', async () => {
        const mockLandlords = [
          {
            id: 1,
            email: 'landlord@example.com',
            role: 'BAILLEUR',
            landlord: {
              id: 1,
              name: 'John Landlord',
              housings: [{ id: 1, address: '123 Main St' }],
            },
          },
        ];

        mockPrismaService.user.findMany.mockResolvedValue(mockLandlords);
        mockPrismaService.user.count.mockResolvedValue(1);

        const result = await service.listLandlords({ page: 1, limit: 20 });

        expect(result.data).toEqual(mockLandlords);
        expect(result.meta.total).toBe(1);
      });
    });

    describe('getLandlordById', () => {
      it('should return landlord with housings', async () => {
        const mockLandlord = {
          id: 1,
          email: 'landlord@example.com',
          role: 'BAILLEUR',
          landlord: {
            id: 1,
            name: 'John Landlord',
            housings: [
              {
                id: 1,
                address: '123 Main St',
                currentTenant: {
                  firstName: 'Jane',
                  lastName: 'Tenant',
                },
              },
            ],
          },
        };

        mockPrismaService.user.findFirst.mockResolvedValue(mockLandlord);

        const result = await service.getLandlordById(1);

        expect(result).toEqual(mockLandlord);
      });

      it('should throw NotFoundException if landlord not found', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(null);

        await expect(service.getLandlordById(999)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  describe('setUserAvailability', () => {
    it('should forbid self deactivation', async () => {
      await expect(
        service.setUserAvailability(
          1,
          { isAvailable: false },
          { id: 1, userId: 1 },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update availability and audit', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 2,
        role: 'BAILLEUR',
        email: 'l@test.com',
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 2,
        isAvailable: false,
      });

      await service.setUserAvailability(
        2,
        { isAvailable: false },
        actor,
      );

      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(mockPrismaService.adminAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('listHousings', () => {
    it('should paginate housings', async () => {
      mockPrismaService.housing.findMany.mockResolvedValue([]);
      mockPrismaService.housing.count.mockResolvedValue(0);

      const result = await service.listHousings({ page: 1, limit: 10 });

      expect(result.meta.total).toBe(0);
      expect(mockPrismaService.housing.findMany).toHaveBeenCalled();
    });
  });

  describe('listAuditLogs', () => {
    it('should return audit entries', async () => {
      mockPrismaService.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrismaService.adminAuditLog.count.mockResolvedValue(0);

      const result = await service.listAuditLogs({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return global statistics', async () => {
        mockPrismaService.$transaction.mockResolvedValue([
          2, 5, 10, 15, 12, 3, 4, 2,
        ]);

        const result = await service.getStats();

        expect(result).toEqual({
          totalAdmins: 2,
          totalLandlords: 5,
          totalTenants: 10,
          totalHousings: 15,
          occupiedHousings: 12,
          vacantHousings: 3,
          ticketsOpen: 4,
          ticketsResolved: 2,
        });
      });
    });

    describe('getDashboardStats', () => {
      it('should return dashboard statistics with recent data and trends', async () => {
        mockPrismaService.$transaction.mockResolvedValue([
          2, 5, 10, 15, 12, 3, 4, 2,
        ]);

        mockPrismaService.user.findMany.mockResolvedValue([]);
        mockPrismaService.ticket.findMany.mockResolvedValue([]);
        mockPrismaService.ticket.count.mockResolvedValue(0);
        mockPrismaService.user.count.mockResolvedValue(0);

        const result = await service.getDashboardStats();

        expect(result).toHaveProperty('stats');
        expect(result).toHaveProperty('recentAdmins');
        expect(result).toHaveProperty('recentLandlords');
        expect(result).toHaveProperty('recentTickets');
        expect(result).toHaveProperty('trends');
        expect(result).toHaveProperty('occupancyRate');
        expect((result as any).trends.last7Days.length).toBe(7);
      });
    });
  });

  describe('AdminController', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should call adminService.createAdmin', async () => {
      const createAdminDto: CreateAdminDto = {
        email: 'admin@example.com',
        phone: '+33612345678',
        password: 'password123',
      };

      jest.spyOn(service, 'createAdmin').mockResolvedValue({
        id: 1,
        email: 'admin@example.com',
        phone: '+33612345678',
        role: 'ADMIN',
        createdAt: new Date(),
        isAvailable: true,
      });

      const result = await controller.createAdmin(createAdminDto, actor);

      expect(result).toBeDefined();
      expect(service.createAdmin).toHaveBeenCalledWith(
        createAdminDto,
        actor,
      );
    });

    it('should call adminService.getStats on GET /admin/stats', async () => {
      const mockStats = {
        totalAdmins: 2,
        totalLandlords: 5,
        totalTenants: 10,
        totalHousings: 15,
        occupiedHousings: 12,
        vacantHousings: 3,
        ticketsOpen: 4,
        ticketsResolved: 2,
      };

      jest.spyOn(service, 'getStats').mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
      expect(service.getStats).toHaveBeenCalled();
    });
  });
});

describe('RolesGuard (admin access)', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(reflector);
    jest.resetAllMocks();
  });

  function ctxWithUser(role: string): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow ADMIN role when required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(guard.canActivate(ctxWithUser('ADMIN'))).toBe(true);
  });

  it('should deny non-admin for admin routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(ctxWithUser('LOCATAIRE'))).toThrow(
      ForbiddenException,
    );
  });

  it('should deny when user missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
