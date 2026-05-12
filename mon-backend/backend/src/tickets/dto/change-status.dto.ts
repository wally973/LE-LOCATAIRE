import { IsString, IsNotEmpty } from 'class-validator';

export class ChangeStatusDto {
  @IsString()
  @IsNotEmpty()
  status: string;
}
