import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendEmailDto } from './dto/send-email.dto';
import { SendPushDto } from './dto/send-push.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { EMAIL_PORT } from './ports/email.port';
import type { EmailPort } from './ports/email.port';
import { PUSH_PORT } from './ports/push.port';
import type { PushPort } from './ports/push.port';

export interface NotifyUserOptions {
  sendEmail?: boolean;
  sendPush?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
    @Inject(PUSH_PORT) private readonly pushPort: PushPort,
  ) {}

  /** Envoi email direct (admin / tests). */
  async sendEmail(dto: SendEmailDto) {
    return this.emailPort.send({
      to: dto.to,
      subject: dto.subject,
      text: dto.message,
    });
  }

  /** Envoi push direct (admin / tests). */
  async sendPush(dto: SendPushDto) {
    const tokens = dto.deviceToken ? [dto.deviceToken] : [];
    return this.pushPort.send({
      tokens,
      title: dto.title,
      body: dto.message,
    });
  }

  /**
   * Canal unique : in-app + email + push selon préférences utilisateur.
   */
  async notifyUser(
    userId: number,
    payload: { title: string; message: string; type: string },
    options?: NotifyUserOptions,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const settings = await this.getOrCreateSettings(userId);
    const wantEmail = options?.sendEmail ?? settings.emailEnabled;
    const wantPush = options?.sendPush ?? settings.pushEnabled;

    if (wantEmail && user?.email) {
      await this.emailPort.send({
        to: user.email,
        subject: payload.title,
        text: payload.message,
      });
    }

    if (wantPush) {
      const devices = await this.prisma.devicePushToken.findMany({
        where: { userId },
        select: { token: true },
      });
      const tokens = devices.map((d) => d.token);
      if (tokens.length > 0) {
        const result = await this.pushPort.send({
          tokens,
          title: payload.title,
          body: payload.message,
          data: { type: payload.type, notificationId: String(notification.id) },
        });
        if (result.invalidTokens.length > 0) {
          await this.prisma.devicePushToken.deleteMany({
            where: { userId, token: { in: result.invalidTokens } },
          });
        }
      }
    }

    return notification;
  }

  /** Rétrocompatibilité — délègue à notifyUser. */
  async createNotification(dto: CreateNotificationDto) {
    return this.notifyUser(dto.userId, {
      title: dto.title,
      message: dto.message,
      type: dto.type,
    });
  }

  async getUserNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: number, notificationId: number) {
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!row) {
      throw new NotFoundException('Notification introuvable');
    }
    if (row.readAt) return row;
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async registerDeviceToken(userId: number, dto: RegisterDeviceTokenDto) {
    return this.prisma.devicePushToken.upsert({
      where: {
        userId_token: { userId, token: dto.token },
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
      update: { platform: dto.platform },
    });
  }

  async removeDeviceToken(userId: number, token: string) {
    const deleted = await this.prisma.devicePushToken.deleteMany({
      where: { userId, token },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Jeton introuvable');
    }
    return { success: true };
  }

  async getSettings(userId: number) {
    return this.getOrCreateSettings(userId);
  }

  async updateSettings(userId: number, dto: UpdateNotificationSettingsDto) {
    await this.getOrCreateSettings(userId);
    return this.prisma.userNotificationSettings.update({
      where: { userId },
      data: {
        ...(dto.emailEnabled !== undefined && {
          emailEnabled: dto.emailEnabled,
        }),
        ...(dto.pushEnabled !== undefined && { pushEnabled: dto.pushEnabled }),
      },
    });
  }

  private async getOrCreateSettings(userId: number) {
    return this.prisma.userNotificationSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}
