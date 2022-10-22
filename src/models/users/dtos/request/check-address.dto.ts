import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEthereumAddress } from 'class-validator';

export class CheckAddressDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsEthereumAddress()
  address: string;
}
