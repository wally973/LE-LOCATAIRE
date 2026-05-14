import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { RegisterDto } from './dto/register.dto';

import { LoginDto } from './dto/login.dto';

import { Role } from '@prisma/client';



/** Utilisateur sérialisable (sans mot de passe). */

export type PublicUser = Omit<import('@prisma/client').User, 'password'>;



@Injectable()

export class AuthService {

  constructor(

    private prisma: PrismaService,

    private jwt: JwtService,

  ) {}



  private toPublicUser(user: import('@prisma/client').User): PublicUser {

    const { password: _omit, ...rest } = user;

    return rest;

  }



  private async composeAuthResponse(userRow: import('@prisma/client').User) {

    const tokens = await this.generateTokens(userRow.id, userRow.role);

    return {

      user: this.toPublicUser(userRow),

      token: tokens.access_token,

      access_token: tokens.access_token,

      refresh_token: tokens.refresh_token,

    };

  }



  /** Création de compte — réservée aux ADMIN (voir contrôleur). */

  async register(dto: RegisterDto) {

    const existing = await this.prisma.user.findFirst({

      where: {

        OR: [

          { phone: dto.phone },

          { email: dto.email },

        ],

      },

    });



    if (existing) {

      throw new ConflictException(

        'Un compte existe déjà avec cet email ou ce numéro',

      );

    }



    const hashed = await bcrypt.hash(dto.password, 10);



    const role = dto.role ?? Role.LOCATAIRE;



    const user = await this.prisma.user.create({

      data: {

        phone: dto.phone,

        email: dto.email,

        password: hashed,

        role,

      },

    });



    return this.composeAuthResponse(user);

  }



  async login(dto: LoginDto) {

    if (!dto.email && !dto.phone) {

      throw new BadRequestException('Email ou téléphone est requis');

    }



    const user = await this.prisma.user.findFirst({

      where: dto.email ? { email: dto.email } : { phone: dto.phone },

    });



    if (!user) {

      throw new UnauthorizedException('Utilisateur introuvable');

    }



    if (!user.isAvailable) {

      throw new UnauthorizedException('Ce compte est désactivé');

    }



    const valid = await bcrypt.compare(dto.password, user.password);

    if (!valid) {

      throw new UnauthorizedException('Mot de passe incorrect');

    }



    return this.composeAuthResponse(user);

  }



  async refresh(refreshToken: string) {

    try {

      const payload = await this.jwt.verifyAsync<{

        sub: number;

        role: Role;

      }>(refreshToken, {

        secret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret',

      });



      const userRow = await this.prisma.user.findUnique({

        where: { id: payload.sub },

      });



      if (!userRow || !userRow.isAvailable) {

        throw new UnauthorizedException('Utilisateur introuvable');

      }



      return this.composeAuthResponse(userRow);

    } catch {

      throw new UnauthorizedException('Token invalide');

    }

  }



  async generateTokens(

    userId: number,

    role: Role,

  ): Promise<{ access_token: string; refresh_token: string }> {

    const user = await this.prisma.user.findUnique({

      where: { id: userId },

      select: { id: true, email: true, role: true, isAvailable: true },

    });



    if (!user) {

      throw new UnauthorizedException('Utilisateur introuvable');

    }



    if (!user.isAvailable) {

      throw new UnauthorizedException('Ce compte est désactivé');

    }



    const payload = {

      sub: userId,

      email: user.email || '',

      role,

    };



    const accessToken = this.jwt.sign(payload, {

      secret: process.env.JWT_SECRET || 'dev_jwt_secret',

      expiresIn: '15m',

    });



    const refreshTokenJwt = this.jwt.sign(payload, {

      secret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret',

      expiresIn: '7d',

    });



    return {

      access_token: accessToken,

      refresh_token: refreshTokenJwt,

    };

  }

}

