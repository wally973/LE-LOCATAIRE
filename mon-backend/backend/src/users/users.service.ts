import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async create(data: { email: string; phone: string; role: Role }) {
    // Génère un mot de passe par défaut
    const defaultPassword = await bcrypt.hash('default123', 10);

    return this.prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        password: defaultPassword,
        role: data.role as Role,
      },
    });
  }

  async updateRole(id: number, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }
}
