import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsEthereumAddress } from '../../../../common/validators/eth-address.validator';

export class TxfRegisterEthAccountDto {
  @ApiProperty()
  @IsEthereumAddress()
  ethAddress: string;

  @ApiProperty()
  @IsString()
  tx: string;
}
