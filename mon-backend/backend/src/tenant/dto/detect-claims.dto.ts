import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DetectClaimsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;
}
