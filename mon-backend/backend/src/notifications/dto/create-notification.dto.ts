export class CreateNotificationDto {
  userId: number;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ALERT';
}
