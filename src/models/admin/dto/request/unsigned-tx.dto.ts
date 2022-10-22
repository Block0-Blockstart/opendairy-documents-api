import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, ValidateNested, IsNotEmpty } from 'class-validator';

export class UnsignedTxDto {
  @ApiProperty()
  @IsNotEmpty()
  data: any;

  @ApiProperty()
  @IsString()
  from: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  to: string;

  @ApiProperty()
  @IsNumber()
  nonce: number;

  @ApiProperty()
  @IsNotEmpty()
  gasLimit: any;

  @ApiProperty()
  @IsNotEmpty()
  gasPrice: any;

  @ApiProperty()
  @IsNumber()
  chainId: number;

  @ApiProperty()
  @IsNumber()
  type: number;
}

export class SignTxDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  mnemonic: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  privateKey: string;

  @ApiProperty()
  @Type(() => UnsignedTxDto)
  @ValidateNested()
  unsignedTx: UnsignedTxDto;
}
