import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../../enums/DocumentType.enum';

export class TxfCreateDocumentRequestDto {
  @ApiProperty()
  @IsString()
  tx: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  deadline: number; //timestamp, optional

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty()
  @IsString()
  requestedToId: string; //requestedTo user id
}
