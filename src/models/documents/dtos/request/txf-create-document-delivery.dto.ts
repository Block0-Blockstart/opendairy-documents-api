import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TxfCreateDocumentDeliveryDto {
  @ApiProperty()
  @IsString()
  tx: string;
}
