import { IsString, IsNotEmpty } from 'class-validator';

export class SignInterventionDto {
  @IsString()
  @IsNotEmpty()
  signatureUrl: string;
}