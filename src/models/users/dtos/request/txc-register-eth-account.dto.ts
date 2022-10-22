import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IsEthereumAddress } from '../../../../common/validators/eth-address.validator';

export class TxcRegisterEthAccountDto {
  @ApiProperty()
  @IsEthereumAddress()
  ethAddress: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pubKey: string;
}
