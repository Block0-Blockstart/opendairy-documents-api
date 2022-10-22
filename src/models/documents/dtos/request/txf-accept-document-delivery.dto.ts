import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TxfAcceptDocumentDeliveryDto {
  @ApiProperty()
  @IsString()
  tx: string;
}
