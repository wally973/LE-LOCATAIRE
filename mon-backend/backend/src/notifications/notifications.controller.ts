import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { SendEmailDto } from './dto/send-email.dto';
import { SendPushDto } from './dto/send-push.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

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
  @Roles('LOCATAIRE', 'BAILLEUR', 'PRESTATAIRE', 'ADMIN', 'AGENT')
  getMyNotifications(@CurrentUser() user: { userId: number }) {
    return this.notificationsService.getUserNotifications(user.userId);
  }

  @Patch('me/settings')
  @ApiOperation({ summary: 'Préférences email / push' })
  @Roles('LOCATAIRE', 'BAILLEUR', 'PRESTATAIRE', 'ADMIN', 'AGENT')
  updateMySettings(
    @CurrentUser() user: { userId: number },
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateSettings(user.userId, dto);
  }

  @Get('me/settings')
  @Roles('LOCATAIRE', 'BAILLEUR', 'PRESTATAIRE', 'ADMIN', 'AGENT')
  getMySettings(@CurrentUser() user: { userId: number }) {
    return this.notificationsService.getSettings(user.userId);
  }

  @Post('me/device-tokens')
  @ApiOperation({ summary: 'Enregistrer un jeton FCM' })
  @Roles('LOCATAIRE', 'BAILLEUR', 'PRESTATAIRE', 'ADMIN', 'AGENT')
  registerDeviceToken(
    @CurrentUser() user: { userId: number },
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(user.userId, dto);
  }

  @Delete('me/device-tokens')
  @Roles('LOCATAIRE', 'BAILLEUR', 'PRESTATAIRE', 'ADMIN', 'AGENT')
  removeDeviceToken(
    @CurrentUser() user: { userId: number },
    @Body('token') token: string,
  ) {
    return this.notificationsService.removeDeviceToken(user.userId, token);
  }

  @Patch(':id/read')
  @Roles('LOCATAIRE', 'BAILLEUR', 'PRESTATAIRE', 'ADMIN', 'AGENT')
  markAsRead(
    @CurrentUser() user: { userId: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markAsRead(user.userId, id);
  }
}
