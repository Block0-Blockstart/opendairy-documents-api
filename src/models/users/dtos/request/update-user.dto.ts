import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { IsEthereumAddress } from '../../../../common/validators/eth-address.validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEthereumAddress()
  ethAddress: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pubKey: string;
}
