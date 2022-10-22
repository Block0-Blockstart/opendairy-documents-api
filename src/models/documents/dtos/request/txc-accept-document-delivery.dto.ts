import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TxcAcceptDocumentDeliveryDto {
  @ApiProperty()
  @IsString()
  documentDeliveryId: string;
}
