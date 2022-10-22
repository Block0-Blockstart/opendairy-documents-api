import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { IsEthereumAddress } from '../../../../common/validators/eth-address.validator';

export class AdminUpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEthereumAddress()
  ethAddress: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pubKey: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  deleted: boolean;
}
