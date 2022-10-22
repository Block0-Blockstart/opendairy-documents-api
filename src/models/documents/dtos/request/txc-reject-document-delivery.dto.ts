import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TxcRejectDocumentDeliveryDto {
  @ApiProperty()
  @IsString()
  documentDeliveryId: string;
}
