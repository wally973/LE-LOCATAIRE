import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { SendEmailDto } from './dto/send-email.dto';
import { SendPushDto } from './dto/send-push.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('email')
  @Roles('ADMIN')
  sendEmail(@Body() dto: SendEmailDto) {
    return this.notificationsService.sendEmail(dto);
  }

  @Post('push')
  @Roles('ADMIN')
  sendPush(@Body() dto: SendPushDto) {
    return this.notificationsService.sendPush(dto);
  }

  @Post('internal')
  @Roles('ADMIN', 'BAILLEUR', 'PRESTATAIRE')
  createNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.createNotification(dto);
  }

  @Get('me')
  @Roles('LOCATAIRE', 'BAILLEUR', 'PRESTATAIRE', 'ADMIN')
  getMyNotifications(@CurrentUser() user) {
    return this.notificationsService.getUserNotifications(user.userId);
  }
}
