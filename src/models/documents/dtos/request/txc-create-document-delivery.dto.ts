import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TxcCreateDocumentDeliveryDto {
  @ApiProperty()
  @IsString()
  documentRequestId: string; // dr id = deploy address

  @ApiProperty()
  @IsString()
  verificationHash: string; //doc hash, as stored in SC

  /* NOTE: we no more need to store sender and receiver here as we have an
    association with a single DR, which have a single requestedBy and a
    single requestedTo.
    So requestedBy is always the receiver and
    requestedTo is always the sender.
  */
}
