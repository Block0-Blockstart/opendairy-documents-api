import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TxcAskUpdateDocumentDeliveryDto {
  @ApiProperty()
  @IsString()
  documentDeliveryId: string;
}
