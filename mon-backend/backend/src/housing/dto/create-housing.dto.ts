import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateHousingDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;        // doit être en Guyane (vérifié dans le service)

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsNumber()
  landlordId: number;  // ID du bailleur
}
