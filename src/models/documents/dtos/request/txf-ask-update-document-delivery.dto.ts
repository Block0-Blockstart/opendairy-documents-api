import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TxfAskUpdateDocumentDeliveryDto {
  @ApiProperty()
  @IsString()
  tx: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  rejectionReason: string;
}
