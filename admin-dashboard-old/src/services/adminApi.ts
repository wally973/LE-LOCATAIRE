import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

/** Réponse paginée renvoyée par le backend admin */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface User {
  id: number;
  email: string | null;
  phone: string;
  role: string;
  createdAt: string;
  isAvailable?: boolean;
}

export interface Admin extends User {
  role: 'ADMIN';
}

export interface Landlord extends User {
  role: 'LANDLORD';
  landlord: {
    id: number;
    name: string;
    logoUrl: string | null;
    housings?: Housing[];
  };
}

export interface Housing {
  id: number;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  isValidated: boolean;
  createdAt?: string;
  landlord?: {
    id: number;
    name: string;
    user?: { id: number; email: string | null; phone: string };
  };
  currentTenant?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
}

export interface Stats {
  totalAdmins: number;
  totalLandlords: number;
  totalTenants: number;
  totalHousings: number;
  occupiedHousings: number;
  vacantHousings: number;
  ticketsOpen: number;
  ticketsResolved: number;
}

export interface DashboardTrendDay {
  date: string;
  newTickets: number;
  newUsers: number;
}

export interface DashboardData {
  stats: Stats;
  occupancyRate: number;
  trends: { last7Days: DashboardTrendDay[] };
  recentAdmins: Admin[];
  recentLandlords: Landlord[];
  recentTickets: any[];
}

export interface AuditLogEntry {
  id: number;
  createdAt: string;
  actorId: number;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  metadata: unknown;
  actor?: {
    id: number;
    email: string | null;
    role: string;
  };
}

export type UserStatusFilter = 'all' | 'active' | 'inactive';
export type HousingOccupancyFilter = 'all' | 'occupied' | 'vacant';

export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatusFilter;
}

export interface HousingListParams extends ListQueryParams {
  occupancy?: HousingOccupancyFilter;
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  search?: string;
  actorId?: number;
}

class AdminApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/admin`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async createAdmin(data: {
    email: string;
    phone: string;
    password: string;
  }): Promise<Admin> {
    const response = await this.api.post('/admins', data);
    return response.data;
  }

  async getAdmins(
    params?: ListQueryParams,
  ): Promise<PaginatedResponse<Admin>> {
    const response = await this.api.get('/admins', { params });
    return response.data;
  }

  async getAdminById(id: number): Promise<Admin> {
    const response = await this.api.get(`/admins/${id}`);
    return response.data;
  }

  async updateAdmin(
    id: number,
    data: Partial<Pick<Admin, 'email' | 'phone'>>,
  ): Promise<Admin> {
    const response = await this.api.patch(`/admins/${id}`, data);
    return response.data;
  }

  async deleteAdmin(id: number): Promise<void> {
    await this.api.delete(`/admins/${id}`);
  }

  async createLandlord(data: {
    email: string;
    phone: string;
    password: string;
    name: string;
    logoUrl?: string;
  }): Promise<Landlord> {
    const response = await this.api.post('/landlords', data);
    return response.data;
  }

  async getLandlords(
    params?: ListQueryParams,
  ): Promise<PaginatedResponse<Landlord>> {
    const response = await this.api.get('/landlords', { params });
    return response.data;
  }

  async getLandlordById(id: number): Promise<Landlord> {
    const response = await this.api.get(`/landlords/${id}`);
    return response.data;
  }

  async updateLandlord(
    id: number,
    data: Partial<{
      email: string;
      phone: string;
      name: string;
      logoUrl: string;
    }>,
  ): Promise<Landlord> {
    const response = await this.api.patch(`/landlords/${id}`, data);
    return response.data;
  }

  async deleteLandlord(id: number): Promise<void> {
    await this.api.delete(`/landlords/${id}`);
  }

  async getHousings(
    params?: HousingListParams,
  ): Promise<PaginatedResponse<Housing>> {
    const response = await this.api.get('/housings', { params });
    return response.data;
  }

  async setUserAvailability(
    userId: number,
    isAvailable: boolean,
  ): Promise<User> {
    const response = await this.api.patch(`/users/${userId}/availability`, {
      isAvailable,
    });
    return response.data;
  }

  async getAuditLogs(
    params?: AuditLogParams,
  ): Promise<PaginatedResponse<AuditLogEntry>> {
    const response = await this.api.get('/audit-logs', { params });
    return response.data;
  }

  async getStats(): Promise<Stats> {
    const response = await this.api.get('/stats');
    return response.data;
  }

  async getDashboard(): Promise<DashboardData> {
    const response = await this.api.get('/dashboard');
    return response.data;
  }
}

export default new AdminApiService();
