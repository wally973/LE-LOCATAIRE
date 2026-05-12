import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendEmailDto } from './dto/send-email.dto';
import { SendPushDto } from './dto/send-push.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ENVOI EMAIL (via provider externe)
  async sendEmail(dto: SendEmailDto) {
    // Ici tu appelles ton provider (SendGrid, Mailjet, AWS SES…)
    // Exemple générique :
    console.log('EMAIL SENT:', dto);

    return { success: true };
  }

  // ENVOI PUSH (via Firebase FCM)
  async sendPush(dto: SendPushDto) {
    // Ici tu appelles Firebase Admin SDK
    console.log('PUSH SENT:', dto);

    return { success: true };
  }

  // NOTIFICATION INTERNE (stockée en base)
  async createNotification(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: dto.type,
      },
    });
  }

  // RÉCUPÉRER LES NOTIFICATIONS D’UN UTILISATEUR
  async getUserNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
