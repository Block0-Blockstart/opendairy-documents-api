import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TxfRejectDocumentDeliveryDto {
  @ApiProperty()
  @IsString()
  tx: string;
}
