import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Readable } from 'stream';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DocumentsService } from './documents.service';
import { TxcAcceptDocumentDeliveryDto } from './dtos/request/txc-accept-document-delivery.dto';
import { TxcAskUpdateDocumentDeliveryDto } from './dtos/request/txc-ask-update-document-delivery.dto';
import { TxcCreateDocumentDeliveryDto } from './dtos/request/txc-create-document-delivery.dto';
import { TxcRejectDocumentDeliveryDto } from './dtos/request/txc-reject-document-delivery.dto';
import { TxfAcceptDocumentDeliveryDto } from './dtos/request/txf-accept-document-delivery.dto';
import { TxfAskUpdateDocumentDeliveryDto } from './dtos/request/txf-ask-update-document-delivery.dto';
import { TxfCreateDocumentDeliveryDto } from './dtos/request/txf-create-document-delivery.dto';
import { TxfCreateDocumentRequestDto } from './dtos/request/txf-create-document-request.dto';
import { TxfRejectDocumentDeliveryDto } from './dtos/request/txf-reject-document-delivery.dto';

@Controller('document')
export class DocumentsController {
  constructor(private documentService: DocumentsService) {}

  ///////////////////////////
  ///  NOT PROTECTED      ///
  ///////////////////////////

  // deliver document type enum used for backend to help frontend consistency
  @Get('schema/document-type')
  getSchemaDocumentType() {
    return this.documentService.getSchemaDocumentType();
  }

  // deliver document delivery enum used for backend to help frontend consistency
  @Get('schema/document-status')
  getSchemaDocumentStatus() {
    return this.documentService.getSchemaDocumentStatus();
  }

  // get file hash
  // the field name for the file in the form data must be named 'file' (1st param of the interceptor)
  @Post('hash')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: 1024 * 1024 * 20 } }))
  getHash(@UploadedFile() file: Express.Multer.File) {
    return this.documentService.computeHash(file);
  }

  ///////////////////////////
  ///     PROTECTED       ///
  ///////////////////////////

  // get DR from DB
  @Get('document-request/:id')
  @UseGuards(AuthGuard)
  findOneDr(@Param('id') id: string, @CurrentUser() user: User) {
    return this.documentService.findOneDr(id, user);
  }

  // get DD from DB
  @Get('document-delivery/:id')
  @UseGuards(AuthGuard)
  findOneDd(@Param('id') id: string, @CurrentUser() user: User) {
    return this.documentService.findOneDd(id, user);
  }

  // get all user DR from DB
  @Get('document-request')
  @UseGuards(AuthGuard)
  findAllDr(@CurrentUser() user: User) {
    return this.documentService.findAllDr(user);
  }

  // get all user DD from DB
  @Get('document-delivery')
  @UseGuards(AuthGuard)
  findAllDd(@CurrentUser() user: User) {
    return this.documentService.findAllDd(user);
  }

  // get history of DDs for a DR, from SC
  @Get('document-request-history/:id')
  @UseGuards(AuthGuard)
  getDocumentHistoryFromContract(@Param('id') id: string, @CurrentUser() user: User) {
    return this.documentService.getDocumentHistoryFromContract(id, user);
  }

  // download from S3
  @Get('download/:id')
  @UseGuards(AuthGuard)
  async getDocumentFromS3(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response
  ) {
    const { data, filename } = await this.documentService.getDocumentFromS3(user, id);
    const stream = data.Body as Readable;
    res.set({
      'Content-Type': data.ContentType,
      //TODO: still needed ? Can't this be 'Content-Disposition': data.ContentDisposition,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(stream);
    // stream.pipe(res);
  }

  // generates the unsigned tx for DR creation
  @Post('document-request/tx-create/create-document-request')
  @UseGuards(AuthGuard)
  txcCreateDocumentRequest(@CurrentUser() user: User) {
    return this.documentService.txcCreateDocumentRequest(user);
  }

  // forwards the signed tx for DR creation
  @Post('document-request/tx-forward/create-document-request')
  @UseGuards(AuthGuard)
  txfCreateDocumentRequest(@CurrentUser() user: User, @Body() body: TxfCreateDocumentRequestDto) {
    return this.documentService.txfCreateDocumentRequest(user, body);
  }

  // generates the unsigned tx for DD creation
  @Post('document-request/tx-create/create-document-delivery')
  @UseGuards(AuthGuard)
  txcCreateDocumentDelivery(@CurrentUser() user: User, @Body() body: TxcCreateDocumentDeliveryDto) {
    return this.documentService.txcCreateDocumentDelivery(user, body);
  }

  // forwards the signed tx for DD creation
  // the field name for the file in the form data must be named 'file' (1st param of the interceptor)
  @Post('document-request/tx-forward/create-document-delivery')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: 1024 * 1024 * 20 } }))
  @UseGuards(AuthGuard)
  txfCreateDocumentDelivery(
    @CurrentUser() user: User,
    @Body() body: TxfCreateDocumentDeliveryDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.documentService.txfCreateDocumentDelivery(user, body, file);
  }

  // generates the unsigned tx for DD accept
  @Post('document-request/tx-create/accept-document-delivery')
  @UseGuards(AuthGuard)
  txcAcceptDocumentDelivery(@CurrentUser() user: User, @Body() body: TxcAcceptDocumentDeliveryDto) {
    return this.documentService.txcAcceptDocumentDelivery(user, body);
  }

  // forwards the signed tx for DD accept
  @Post('document-request/tx-forward/accept-document-delivery')
  @UseGuards(AuthGuard)
  txfAcceptDocumentDelivery(@CurrentUser() user: User, @Body() body: TxfAcceptDocumentDeliveryDto) {
    return this.documentService.txfAcceptDocumentDelivery(user, body);
  }

  // generates the unsigned tx for DD reject
  @Post('document-request/tx-create/reject-document-delivery')
  @UseGuards(AuthGuard)
  txcRejectDocumentDelivery(@CurrentUser() user: User, @Body() body: TxcRejectDocumentDeliveryDto) {
    return this.documentService.txcRejectDocumentDelivery(user, body);
  }

  // forwards the signed tx for DD reject
  @Post('document-request/tx-forward/reject-document-delivery')
  @UseGuards(AuthGuard)
  txfRejectDocumentDelivery(@CurrentUser() user: User, @Body() body: TxfRejectDocumentDeliveryDto) {
    return this.documentService.txfRejectDocumentDelivery(user, body);
  }

  // generates the unsigned tx for DD ask update
  @Post('document-request/tx-create/ask-update-document-delivery')
  @UseGuards(AuthGuard)
  txcAskUpdateDocumentDelivery(@CurrentUser() user: User, @Body() body: TxcAskUpdateDocumentDeliveryDto) {
    return this.documentService.txcAskUpdateDocumentDelivery(user, body);
  }

  // forwards the signed tx for DD ask update
  @Post('document-request/tx-forward/ask-update-document-delivery')
  @UseGuards(AuthGuard)
  txfAskUpdateDocumentDelivery(@CurrentUser() user: User, @Body() body: TxfAskUpdateDocumentDeliveryDto) {
    return this.documentService.txfAskUpdateDocumentDelivery(user, body);
  }
}
