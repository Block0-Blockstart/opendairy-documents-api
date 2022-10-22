import {
  BadRequestException,
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ContractsService } from '../../services/contracts/contracts.service';
import { IUnsignedTx } from '../../services/contracts/interface';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { TxcAcceptDocumentDeliveryDto } from './dtos/request/txc-accept-document-delivery.dto';
import { TxcAskUpdateDocumentDeliveryDto } from './dtos/request/txc-ask-update-document-delivery.dto';
import { TxcCreateDocumentDeliveryDto } from './dtos/request/txc-create-document-delivery.dto';
import { TxcRejectDocumentDeliveryDto } from './dtos/request/txc-reject-document-delivery.dto';
import { TxfAcceptDocumentDeliveryDto } from './dtos/request/txf-accept-document-delivery.dto';
import { TxfAskUpdateDocumentDeliveryDto } from './dtos/request/txf-ask-update-document-delivery.dto';
import { TxfCreateDocumentDeliveryDto } from './dtos/request/txf-create-document-delivery.dto';
import { TxfCreateDocumentRequestDto } from './dtos/request/txf-create-document-request.dto';
import { TxfRejectDocumentDeliveryDto } from './dtos/request/txf-reject-document-delivery.dto';
import { DocumentDelivery } from './entities/document-delivery.entity';
import { DocumentRequest } from './entities/document-request.entity';
import { DocumentDeliveryStatus, getDocumentDeliveryStatuses } from './enums/DocumentDeliveryStatus.enum';
import { getDocumentTypes } from './enums/DocumentType.enum';
import { TxcArgs } from './interfaces';
import { formatBytes32String, isAddress } from 'ethers/lib/utils';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { AppConfigService, Environment } from '../../config/app/app.config.service';
import { bufferToHash } from '../../helpers/hasher';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger('DocumentsService');
  private readonly s3Config: S3ClientConfig;

  constructor(
    @InjectRepository(DocumentRequest) private drRepo: Repository<DocumentRequest>,
    @InjectRepository(DocumentDelivery) private ddRepo: Repository<DocumentDelivery>,
    private contractService: ContractsService,
    private userService: UsersService,
    private cs: AppConfigService
  ) {
    this.s3Config =
      cs.NODE_ENV === Environment.Production
        ? { region: this.cs.AWS_S3_REGION }
        : {
            region: this.cs.AWS_S3_REGION,
            credentials: {
              accessKeyId: this.cs.AWS_S3_ACCESS_KEY_ID,
              secretAccessKey: this.cs.AWS_S3_SECRET_ACCESS_KEY,
            },
          };
  }

  /**
   *
   * Returns the document type enum used in this backend as a key/value object,
   * to help frontend consistency
   *
   */
  getSchemaDocumentType() {
    return getDocumentTypes();
  }

  /**
   *
   * Returns the document status enum used in this backend as a key/value object,
   * to help frontend consistency
   *
   */
  getSchemaDocumentStatus() {
    return getDocumentDeliveryStatuses();
  }

  /**
   *
   * Returns a document request (dr) from DB.
   * Fails 404 if not found.
   *
   * Fails 403 if user making the request is neither the requestedTo nor the requestedBy of this dr.
   *
   * We return the ids of the users instead of the user entities. If we change this and return users entities, we need to create
   * a user output dto to remove user fields that should not public
   *
   * This is how the response looks like:
   * @example {
   *   id: '0x4Be19C5113244337008b02159aeA84998Fb68a71',
   *   requestDate: 1663170516763,
   *   deadline: 1666224000000,
   *   documentType: 'Packing list',
   *   documentDeliveries: [
   *     {
   *       id: '0xb328851e2fd77f461d2e0cc3b3b2b46e80be5a1a1c61a230fe6d1e7a1a405d69',
   *       sentDate: 1663208049378,
   *       verificationHash: '0x6572676572676572676572676572676572670000000000000000000000000000',
   *       url: 'S3_URL',
   *       status: 'TO_BE_REVIEWED',
   *       rejectionReason: null,
   *     },
   *   ],
   *   requestedTo: { id: 'test2@test.com' },
   *   requestedBy: { id: 'test4@test.com' },
   * }
   *
   */
  async findOneDr(id: string, user: User) {
    const dr = await this.drRepo
      .createQueryBuilder()
      .select('dr')
      .from(DocumentRequest, 'dr')
      .leftJoinAndSelect('dr.documentDeliveries', 'dd')
      .leftJoinAndSelect('dr.requestedTo', 'user_rt')
      .leftJoinAndSelect('dr.requestedBy', 'user_rb')
      .select(['dr', 'dd', 'user_rt.id', 'user_rb.id'])
      .where('dr.id = :id', { id })
      .getOne();

    if (!dr) throw new NotFoundException('Document Request not found');
    if (dr.requestedBy.id !== user.id && dr.requestedTo.id !== user.id)
      throw new ForbiddenException('User is neither requestedBy nor requestedTo.');

    return dr;
  }

  /**
   *
   * Returns a document delivery (dd) from DB.
   * Fails 404 if not found.
   *
   * Fails 403 if user making the request is neither the requestedTo nor the requestedBy in the Document Request (dr) linked to this dd.
   *
   * This is how the response looks like:
   * @example {
   *   id: '0xb328851e2fd77f461d2e0cc3b3b2b46e80be5a1a1c61a230fe6d1e7a1a405d69',
   *   sentDate: 1663208049378,
   *   verificationHash: '0x6572676572676572676572676572676572670000000000000000000000000000',
   *   url: 'S3_URL',
   *   status: 'TO_BE_REVIEWED',
   *   rejectionReason: null,
   *   documentRequest: {
   *     id: '0x4Be19C5113244337008b02159aeA84998Fb68a71',
   *     requestDate: 1663170516763,
   *     deadline: 1666224000000,
   *     documentType: 'Packing list',
   *     requestedTo: { id: 'test2@test.com' },
   *     requestedBy: { id: 'test4@test.com' }
   *   }
   * }
   *
   */
  async findOneDd(id: string, user: User) {
    const dd = await this.ddRepo
      .createQueryBuilder()
      .select('dd')
      .from(DocumentDelivery, 'dd')
      .leftJoinAndSelect('dd.documentRequest', 'dr')
      .leftJoinAndSelect('dr.requestedTo', 'user_rt')
      .leftJoinAndSelect('dr.requestedBy', 'user_rb')
      .select(['dr', 'dd', 'user_rt.id', 'user_rb.id'])
      .where('dd.id = :id', { id })
      .getOne();

    if (!dd) throw new NotFoundException('Document Delivery not found');
    if (dd.documentRequest.requestedTo.id !== user.id && dd.documentRequest.requestedBy.id !== user.id)
      throw new ForbiddenException('User is neither requestedBy nor requestedTo.');

    return dd;
  }

  /**
   *
   * Returns all DRs from DB, where the user is either the requestedBy or the requestedTo.
   *
   * Array of DDs for each DR is populated with all DD props.
   *
   * Props representing a user (requestedBy and requestedTo) are populated with id only,
   * like ```requestedTo: { id: "test2@test.com" }```
   *
   */
  async findAllDr(user: User) {
    return await this.drRepo
      .createQueryBuilder()
      .select('dr')
      .from(DocumentRequest, 'dr')
      .leftJoinAndSelect('dr.documentDeliveries', 'dd')
      .leftJoinAndSelect('dr.requestedTo', 'user_rt')
      .leftJoinAndSelect('dr.requestedBy', 'user_rb')
      .select(['dr', 'dd', 'user_rt.id', 'user_rb.id'])
      .where('user_rt.id = :id OR user_rb.id = :id', { id: user.id })
      .getMany();
  }

  /**
   *
   * Returns all DDs from DB, but only if the user is either the requestedBy or
   * the requestedTo in the DR related to the DD.
   *
   * All DRs are populated with all their props.
   *
   * Props representing a user (requestedBy and requestedTo) are populated with id only,
   * like ```requestedTo: { id: "test2@test.com" }```
   *
   */
  async findAllDd(user: User) {
    return await this.ddRepo
      .createQueryBuilder()
      .select('dd')
      .from(DocumentDelivery, 'dd')
      .leftJoinAndSelect('dd.documentRequest', 'dr')
      .leftJoinAndSelect('dr.requestedTo', 'user_rt')
      .leftJoinAndSelect('dr.requestedBy', 'user_rb')
      .select(['dr', 'dd', 'user_rt.id', 'user_rb.id'])
      .where('user_rt.id = :id OR user_rb.id = :id', { id: user.id })
      .getMany();
  }

  /**
   *
   * Computes the history of DDs' submitted to a Document smart contract.
   * Returns an array where items are in the order they where received by
   * the smart contract.
   * Each item includes the hash of the document submitted and the status applied to it.
   *
   */
  async getDocumentHistoryFromContract(id: string, user: User) {
    /* Note: the document contract returns a tuple of arrays.
      This is what we receive:
        [
          [ "0xsomeHash", "0xsomeHash2" ],  ==> array of hashes, in the order they where received by the SC
          [ 2, 3 ], ==> array of statuses, applied to above hashes, in the same order
        ]
 
      And this is what this function will return: 
        [
          { "hash": "0xsomeHash", "status": "UPDATE_REQUIRED" },
          { "hash": "0xsomeHash2", "status": "ACCEPTED" },
        ] ==> array in the order they where received by the SC
    */

    await this.findOneDr(id, user);

    const [hashes, statuses] = await this.contractService.callContractFunction({
      contractName: 'document',
      fnName: 'getHistory',
      address: id,
    });

    const parseStatus = (statusNum: number) =>
      statusNum === 1
        ? DocumentDeliveryStatus.TO_BE_REVIEWED
        : statusNum === 2
        ? DocumentDeliveryStatus.UPDATE_REQUIRED
        : statusNum === 3
        ? DocumentDeliveryStatus.ACCEPTED
        : statusNum === 4
        ? DocumentDeliveryStatus.REJECTED
        : statusNum === 5
        ? DocumentDeliveryStatus.DROPPED
        : 'unknown state';

    const res = [];
    for (let i = 0; i < hashes.length; i++) {
      res.push({ hash: hashes[i], status: parseStatus(statuses[i]) });
    }
    return res;
  }

  /**
   *
   * Returns a serialized json of the unsigned tx required to
   * deploy a Document smart contract.
   *
   * Note: if user has not ethAccount, it throws a 403 Forbidden.
   *
   * Note: this function expects that the user exists (previous check should be done with the AuthGuard).
   *
   */
  async txcCreateDocumentRequest(user: User) {
    return await this._txc(user, {});
  }

  /**
   *
   * Forwards Document smart contract deployment tx and
   * then adds a Document Request in DB.
   *
   * Note: the requestedTo value is managed only in DB, not in the SC.
   * Indeed, we could add a feature allowing anybody (or agents) to send a Document Delivery
   * to fulfill the request, on the behalf of the requestedTo user.
   *
   */
  async txfCreateDocumentRequest(
    user: User,
    { tx, documentType, deadline, requestedToId }: TxfCreateDocumentRequestDto
  ) {
    //requester has no eth account
    this._checkEthAddress(user);

    let requestedTo: User;
    //requestee does not exist
    try {
      requestedTo = await this.userService.findOne(requestedToId, true);
    } catch (e) {
      throw new BadRequestException(`User ${requestedToId} (requestedTo) does not exist.`);
    }

    if (!requestedTo.ethAddress) {
      throw new BadRequestException(`User ${requestedToId} (requestedTo) has not Ethereum account.`);
    }

    // check the tx
    try {
      this.contractService.checkSignedDeployTx({
        signedTx: tx,
        from: user.ethAddress,
        nonce: user.lastNonceUsed,
        throwOnFirstError: true,
      });
    } catch (e) {
      this.logger.log(e);
      if (e.message.includes('Unexpected value [nonce]')) {
        //explicit nonce error, so the frontend knows it can be retried
        throw new BadRequestException(`Invalid transaction: ${e.message}`);
      } else {
        //any other error is caused by manipulations (with or without bad intentions) of the tx
        throw new BadRequestException('Invalid transaction.');
      }
    }

    //let this throw if it should
    const { contractAddress } = await this.contractService.forwardSignedTx('document', tx);

    const documentRequest = this.drRepo.create({
      id: contractAddress,
      requestDate: Date.now(),
      deadline: deadline,
      documentType: documentType,
      requestedBy: user,
      requestedTo,
    });

    // save
    const created = await this.drRepo.save(documentRequest);
    this.logger.verbose(`Document Request contract at address: ${created.id} created in database.`);
    return created;
  }

  /**
   *
   * Returns a serialized json of the unsigned tx required to
   * send a Document Delivery (dd).
   *
   * Note: if user has not ethAccount, it throws a 403 Forbidden.
   *
   * Note: this function expects that the user exists (previous check should be done with the AuthGuard).
   *
   */
  async txcCreateDocumentDelivery(user: User, { documentRequestId, verificationHash }: TxcCreateDocumentDeliveryDto) {
    return await this._txc(user, {
      fn: 'sendDocument',
      fnParams: [formatBytes32String(verificationHash)],
      to: documentRequestId,
    });
  }

  /**
   *
   * Forwards a signed tx to send a Document Delivery (dd) to a Document smart contract,
   * then adds the dd in DB.
   *
   */
  async txfCreateDocumentDelivery(user: User, { tx }: TxfCreateDocumentDeliveryDto, file: Express.Multer.File) {
    /* Notes:
     * 1) file.destination, file.filename and file.path will be undefined because
     *    we don't store file in specific folder
     * 2) file.fieldname will always be 'file' because this is a validation
     *    condition in the controller. ==> we do not re-check this here.
     * 3) We do not add conditions on file.mimetype here because this api could
     *    potentialy accept anything. The frontend could add some restrictions,
     *    like disallowing .exe files, or anything suspicious.
     * 4) We do not stream the file directly to S3. File is buffered, the hash is
     *    computed locally, then the file buffer is forwarded to S3.
     * 5) The hash is stored on blockchain and in DB. We do not rely on the hash
     *    computed by S3 as it is not reliable. ==> There are too many cases where
     *    checksums computed by AWS would trigger (falsy) failures because it is
     *    computed with different algorithms depending on the case. Big files using
     *    multipart have : final checksum = checksum of the concatenated checksums
     *    of each part + number of parts, while checksum of small files are computed
     *    for the whole file at once. And worse: checksum is not computed the same
     *    way if file is dropped via AWS S3 console or programatically. And even
     *    worse: the checksum is re-computed when file is renamed or copied, and
     *    potentially using a different method causing different hashes.
     *    See https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html
     */

    this._checkEthAddress(user);
    this._checkFile(file);

    const hash = bufferToHash(file.buffer);
    const bytes32Hash = formatBytes32String(hash);

    if (!user.emailHash) throw new ForbiddenException('User has invalid account (missing emailHash).');

    const documentRequestId = this._extractTxRecipient(tx);

    // gets the dr associated to this dd. If not found, this will throw http exception.
    // NEVER send the tx to the SC before checking that the DB knows the SC address used in this tx, which is the DR id.
    // If we do not check this (and prevent the tx to be sent), this function could be used to send txs to any SC.
    const documentRequest = await this.findOneDr(documentRequestId, user);

    const url = `${user.emailHash}/${file.originalname}`;

    const S3 = new S3Client(this.s3Config);
    const bucketConfig = { Bucket: this.cs.AWS_S3_BUCKET_NAME, Key: url };
    const ContentDisposition = `attachment; filename="${file.originalname}"`;

    try {
      await S3.send(new PutObjectCommand({ ...bucketConfig, Body: file.buffer, ContentDisposition }));
      this.logger.verbose(`File uploaded to S3: ${url}`);
    } catch (e) {
      this._handleFatalError('Error while sending file to S3.', e);
    }

    const revertS3 = async () => {
      this.logger.verbose(`Reverting S3 upload for file: ${url}`);
      try {
        await S3.send(new DeleteObjectCommand(bucketConfig));
        this.logger.verbose(`Success - file deleted from S3: ${url}`);
      } catch (e) {
        this._handleFatalError('Error while deleting file from S3.', e);
      }
    };

    //checks the tx, including comparison of the hash and the hash claimed in the transaction
    try {
      this.contractService.checkSignedTx({
        signedTx: tx,
        nonce: user.lastNonceUsed,
        from: user.ethAddress,
        fn: {
          contractName: 'document',
          fnName: 'sendDocument',
          fnArgNames: ['hash'],
          fnArgValues: [bytes32Hash],
        },
        throwOnFirstError: true,
      });
    } catch (e) {
      this.logger.log(e);
      if (e.message.includes('Unexpected value [nonce]')) {
        await revertS3();
        //explicit nonce error, so the frontend knows it can be retried
        throw new BadRequestException(`Invalid transaction: ${e.message}`);
      } else {
        await revertS3();
        //any other error is caused by manipulations (with or without bad intentions) of the tx
        throw new BadRequestException('Invalid transaction.');
      }
    }

    // forward the signed tx to the bc.
    let transactionHash: string;
    try {
      ({ transactionHash } = await this.contractService.forwardSignedTx('document', tx));
    } catch (e) {
      // if (e?.message !== 'Same document is already waiting for review'); //NO: always revert
      await revertS3();
      // then, rethrow the error (error manager will provide either an http error, i.e. for revert messages,
      // or will crash the app if necessary
      throw e;
    }

    /* 
      Translation of the smart contract operations to the database:
      ************************************************************* 
      There are exactly 3 cases where the smart contract will allow the DD:
      1) This is the first DD for this DR. In this case, the DD will receive a status of TO_BE_REVIEWED.
      2) The last DD had a status of UPDATE_REQUIRED. In this case, this last DD will keep this status for 
         traceability reason and the new one will have a status of TO_BE_REVIEWED.
      3) The last DD had a status of TO_BE_REVIEWED AND the hash of this last DD is different from
         the hash of the new one. In this case, this last DD will change its status to DROPPED meaning
         that the issuer has decided to drop his document and replace it by another before the document is reviewed.
         The new DD will have a status of TO_BE_REVIEWED.
      
      All other DD will fail on the smart contract side and this function will exit.
      So we need to translate only the valid operations to the database.

      The process is:
      
      if not_exists last DD, then create new DD with TO_BE_REVIEWED
      if exists last DD, then {
        if last DD status = UPDATE_REQUIRED, then create new DD with TO_BE_REVIEWED
        else if last DD status = TO_BE_REVIEWED && last DD hash !== new DD hash, then create new DD with TO_BE_REVIEWED and change last DD status to DROPPPED
       }

      Note: last DD is always the DD having the highest sentDate timestamp among all the DD of a DR.
    */

    const processCreateDd = async () => {
      const documentDelivery = this.ddRepo.create({
        id: transactionHash,
        sentDate: Date.now(),
        documentRequest,
        verificationHash: hash,
        status: DocumentDeliveryStatus.TO_BE_REVIEWED,
        url,
      });

      try {
        const createdDd = await this.ddRepo.save(documentDelivery);
        this.logger.verbose(
          `Document Delivery with tx hash: ${createdDd.id} created in database with status ${createdDd.status}.`
        );
        return createdDd;
      } catch (e) {
        this._handleFatalError('Error while updating DB after a successful tx forward. DB will be desynchronized !', e);
        // TODO : this operation SHOULD succeed (because BC has already recorded the fact). So, we must retry until it's ok.
      }
    };

    const lastDd = await this._findLastDdFromDr(documentRequestId);

    if (!lastDd) {
      return await processCreateDd();
    } else if (lastDd.status === DocumentDeliveryStatus.UPDATE_REQUIRED) {
      return await processCreateDd();
    } else if (lastDd.status === DocumentDeliveryStatus.TO_BE_REVIEWED) {
      lastDd.status = DocumentDeliveryStatus.DROPPED;
      try {
        const updatedLastDd = await this.ddRepo.save(lastDd);
        this.logger.verbose(
          `Document Delivery with tx hash: ${updatedLastDd.id} was dropped because another file was uploaded to replace it.`
        );
      } catch (e) {
        this._handleFatalError('Error while updating DB after a successful tx forward. DB will be desynchronized !', e);
        // TODO : this operation SHOULD succeed (because BC has already recorded the fact). So, we must retry until it's ok.
      }
      return await processCreateDd();
    } else {
      this._handleFatalError('The database logic rejects DD creation but the smart contract has accepted it');
    }
  }

  /**
   *
   * Returns a serialized json of the unsigned tx required to
   * accept a Document Delivery (dd).
   *
   * Note: if user has not ethAccount, it throws a 403 Forbidden.
   *
   * Note: this function expects that the user exists (previous check should be done with the AuthGuard).
   *
   */
  async txcAcceptDocumentDelivery(user: User, { documentDeliveryId }: TxcAcceptDocumentDeliveryDto) {
    const dd = await this.findOneDd(documentDeliveryId, user);
    return await this._txc(user, { fn: 'acceptDocument', to: dd.documentRequest.id });
  }

  /**
   *
   * Forwards a signed tx to accept a Document Delivery (dd),
   * then updates the dd in DB.
   *
   */
  async txfAcceptDocumentDelivery(user: User, { tx }: TxfAcceptDocumentDeliveryDto) {
    this._checkEthAddress(user);

    const documentRequestId = this._extractTxRecipient(tx);

    try {
      this.contractService.checkSignedTx({
        signedTx: tx,
        nonce: user.lastNonceUsed,
        from: user.ethAddress,
        fn: {
          contractName: 'document',
          fnName: 'acceptDocument',
          fnArgNames: [],
          fnArgValues: [],
        },
        throwOnFirstError: true,
      });
    } catch (e) {
      this.logger.log(e);
      if (e.message.includes('Unexpected value [nonce]')) {
        //explicit nonce error, so the frontend knows it can be retried
        throw new BadRequestException(`Invalid transaction: ${e.message}`);
      } else {
        //any other error is caused by manipulations (with or without bad intentions) of the tx
        throw new BadRequestException('Invalid transaction.');
      }
    }

    // forward the signed tx to the bc (let it throws if needed).
    await this.contractService.forwardSignedTx('document', tx);

    // updates in db
    const lastDd = await this._findLastDdFromDr(documentRequestId);

    if (!lastDd) {
      this._handleFatalError('Trying to accept a DD but there is no DD in this DR.');
    }
    if (lastDd.status !== DocumentDeliveryStatus.TO_BE_REVIEWED) {
      this._handleFatalError('Trying to accept a DD but last DD has not the state TO_BE_REVIEWED.');
    }

    lastDd.status = DocumentDeliveryStatus.ACCEPTED;

    try {
      const updated = this.ddRepo.save(lastDd);
      this.logger.verbose(`Document delivery for document request [${documentRequestId}] has been accepted.`);
      return updated;
    } catch (e) {
      this._handleFatalError('Error while updating DB after a successful tx forward. DB will be desynchronized !', e);
      // TODO : this operation SHOULD succeed (because BC has already recorded the fact). So, we must retry until it's ok.
    }
  }

  /**
   *
   * Returns a serialized json of the unsigned tx required to
   * reject a Document Delivery (dd).
   *
   * Note: if user has not ethAccount, it throws a 403 Forbidden.
   *
   * Note: this function expects that the user exists (previous check should be done with the AuthGuard).
   *
   */
  async txcRejectDocumentDelivery(user: User, { documentDeliveryId }: TxcRejectDocumentDeliveryDto) {
    const dd = await this.findOneDd(documentDeliveryId, user);
    return await this._txc(user, { fn: 'rejectDocument', to: dd.documentRequest.id });
  }

  /**
   *
   * Forwards a signed tx to reject a Document Delivery (dd),
   * then updates the dd in DB.
   *
   */
  async txfRejectDocumentDelivery(user: User, { tx }: TxfRejectDocumentDeliveryDto) {
    this._checkEthAddress(user);

    const documentRequestId = this._extractTxRecipient(tx);

    try {
      this.contractService.checkSignedTx({
        signedTx: tx,
        nonce: user.lastNonceUsed,
        from: user.ethAddress,
        fn: {
          contractName: 'document',
          fnName: 'rejectDocument',
          fnArgNames: [],
          fnArgValues: [],
        },
        throwOnFirstError: true,
      });
    } catch (e) {
      this.logger.log(e);
      if (e.message.includes('Unexpected value [nonce]')) {
        //explicit nonce error, so the frontend knows it can be retried
        throw new BadRequestException(`Invalid transaction: ${e.message}`);
      } else {
        //any other error is caused by manipulations (with or without bad intentions) of the tx
        throw new BadRequestException('Invalid transaction.');
      }
    }

    // forward the signed tx to the bc (let it throws if needed).
    await this.contractService.forwardSignedTx('document', tx);

    // updates in db
    const lastDd = await this._findLastDdFromDr(documentRequestId);

    if (!lastDd) {
      this._handleFatalError('Trying to reject a DD but there is no DD in this DR.');
    }
    if (lastDd.status !== DocumentDeliveryStatus.TO_BE_REVIEWED) {
      this._handleFatalError('Trying to reject a DD but last DD has not the state TO_BE_REVIEWED.');
    }

    lastDd.status = DocumentDeliveryStatus.REJECTED;

    try {
      const updated = this.ddRepo.save(lastDd);
      this.logger.verbose(`Document delivery for document request [${documentRequestId}] has been rejected.`);
      return updated;
    } catch (e) {
      this._handleFatalError('Error while updating DB after a successful tx forward. DB will be desynchronized !', e);
      // TODO : this operation SHOULD succeed (because BC has already recorded the fact). So, we must retry until it's ok.
    }
  }

  /**
   *
   * Returns a serialized json of the unsigned tx required to
   * ask an update of a Document Delivery (dd).
   *
   * Note: if user has not ethAccount, it throws a 403 Forbidden.
   *
   * Note: this function expects that the user exists (previous check should be done with the AuthGuard).
   *
   */
  async txcAskUpdateDocumentDelivery(user: User, { documentDeliveryId }: TxcAskUpdateDocumentDeliveryDto) {
    const dd = await this.findOneDd(documentDeliveryId, user);
    return await this._txc(user, { fn: 'askUpdateDocument', to: dd.documentRequest.id });
  }

  /**
   *
   * Forwards a signed tx to ask an update on a Document Delivery (dd),
   * then updates the dd in DB.
   *
   */
  async txfAskUpdateDocumentDelivery(user: User, { tx, rejectionReason }: TxfAskUpdateDocumentDeliveryDto) {
    this._checkEthAddress(user);

    const documentRequestId = this._extractTxRecipient(tx);

    try {
      this.contractService.checkSignedTx({
        signedTx: tx,
        nonce: user.lastNonceUsed,
        from: user.ethAddress,
        fn: {
          contractName: 'document',
          fnName: 'askUpdateDocument',
          fnArgNames: [],
          fnArgValues: [],
        },
        throwOnFirstError: true,
      });
    } catch (e) {
      this.logger.log(e);
      if (e.message.includes('Unexpected value [nonce]')) {
        //explicit nonce error, so the frontend knows it can be retried
        throw new BadRequestException(`Invalid transaction: ${e.message}`);
      } else {
        //any other error is caused by manipulations (with or without bad intentions) of the tx
        throw new BadRequestException('Invalid transaction.');
      }
    }

    // forward the signed tx to the bc (let it throws if needed).
    await this.contractService.forwardSignedTx('document', tx);

    // updates in db
    const lastDd = await this._findLastDdFromDr(documentRequestId);

    if (!lastDd) {
      this._handleFatalError('Trying to ask DD update but there is no DD in this DR.');
    }
    if (lastDd.status !== DocumentDeliveryStatus.TO_BE_REVIEWED) {
      this._handleFatalError('Trying to ask DD update but last DD has not the state TO_BE_REVIEWED.');
    }

    lastDd.status = DocumentDeliveryStatus.UPDATE_REQUIRED;
    lastDd.rejectionReason = rejectionReason;

    try {
      const updated = this.ddRepo.save(lastDd);
      this.logger.verbose(`Document delivery for document request [${documentRequestId}] was asked to be updated.`);
      return updated;
    } catch (e) {
      this._handleFatalError('Error while updating DB after a successful tx forward. DB will be desynchronized !', e);
      // TODO : this operation SHOULD succeed (because BC has already recorded the fact). So, we must retry until it's ok.
    }
  }

  /**
   *
   * Download from S3. File hash is not verified.
   *
   */
  async getDocumentFromS3(user: User, id: string) {
    const dd = await this.findOneDd(id, user);
    const { url } = dd;

    const S3 = new S3Client(this.s3Config);

    try {
      const data = await S3.send(
        new GetObjectCommand({
          Bucket: this.cs.AWS_S3_BUCKET_NAME,
          Key: `${url}`,
        })
      );

      // TODO: still needed ?
      return { data, filename: url.split('/')[1] || 'copy' };
    } catch (e) {
      if (e.Code && e.Code === 'NoSuchKey') {
        throw new NotFoundException('File does not exist.');
      }
      this._handleFatalError(`Unexpected error while retrieving file: ${url}. See below: `, e);
    }
  }

  /**
   *
   * Computes hash of a file. Uses blake2 alg, with 12 bytes output (= 24-length hexstring).
   *
   */
  computeHash(file: Express.Multer.File) {
    this._checkFile(file);
    return bufferToHash(file.buffer);
  }

  /**
   *
   * Private. Throws if user has no eth address
   *
   */
  private _checkFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file attached to the request.');
    if (!file.size) throw new BadRequestException('Attached file is empty.');
    if (!file.originalname) throw new BadRequestException('Attached file has no name.');
    if (!file.buffer) throw new BadRequestException('Attached file cannot be buffered.');
  }

  /**
   *
   * Private. Throws if file is not valid
   *
   */
  private _checkEthAddress(user: User) {
    if (!user.ethAddress) throw new ForbiddenException('User has no Ethereum address.');
  }

  /**
   *
   * Private.
   * Helper to create unsigned tx involving document contract
   * If 'address' param is not provided, th tx will be a contract deployment
   *
   */
  private async _txc(user: User, { fn, fnParams, to }: TxcArgs) {
    this._checkEthAddress(user);

    let utx: IUnsignedTx;

    if (!to) {
      utx = await this.contractService.createUnsignedContract({
        contractName: 'document',
        from: user.ethAddress,
      });
    } else {
      if (!isAddress(to)) throw new BadRequestException(`Invalid recipient: ${to}`);

      utx = await this.contractService.createUnsignedTx({
        contractName: 'document',
        from: user.ethAddress,
        fn,
        fnParams: fnParams || [],
        to,
      });
    }

    await this.userService.setLastNonceUsed(user.id, utx.nonce);
    return JSON.stringify(utx);
  }

  /**
   *
   * Parses a signed tx, look for recipient address ('to'), returns it.
   * WARNING: This will throw if the tx is a contract deployment.
   *
   */
  private _extractTxRecipient(signedTx: string) {
    try {
      const { to } = this.contractService.parseSignedTx(signedTx);
      return to;
    } catch (e) {
      this.logger.log(e);
      throw new BadRequestException('Invalid transaction.');
    }
  }

  /**
   *
   * Returns all DDs related to given DR from DB.
   *
   * All DRs are populated with all their props.
   *
   * Props representing a user (requestedBy and requestedTo) are populated with id only,
   * like ```requestedTo: { id: "test2@test.com" }```
   *
   */
  private async _findAllDdFromDr(documentRequestId: string) {
    return await this.ddRepo
      .createQueryBuilder()
      .select('dd')
      .from(DocumentDelivery, 'dd')
      .leftJoinAndSelect('dd.documentRequest', 'dr')
      .leftJoinAndSelect('dr.requestedTo', 'user_rt')
      .leftJoinAndSelect('dr.requestedBy', 'user_rb')
      .select(['dr', 'dd', 'user_rt.id', 'user_rb.id'])
      .where('dr.id = :drId', { drId: documentRequestId })
      .getMany();
  }

  /**
   *
   * For a given DR, search all its DDs and retrieve the one having status "TO_BE_REVIEWED".
   * If more than one have this status, throws a fatal error as it should NEVER happen.
   * If no one is found, retruns null.
   *
   */
  private async _findLastDdFromDr(documentRequestId: string): Promise<DocumentDelivery | null> {
    const dds = await this._findAllDdFromDr(documentRequestId);
    if (!dds.length) return null;
    return dds.sort((dd1, dd2) => dd1.sentDate - dd2.sentDate).pop();
  }

  /**
   *
   * Instead of crashing the app, this function logs you error message and throws
   * a 500 with "DDS" error (Developer Did Shit)
   *
   */
  private _handleFatalError(message: string, additionalConsole?: any) {
    this.logger.error(`The application encountered a serious error.`);
    this.logger.error(`Data may be de-synchronized between blockchain and database.`);
    this.logger.error(`This is more probably the result of a bad code.`);
    this.logger.error(`More information for debugging is provided below, if available:`);
    this.logger.error(message);
    if (additionalConsole) console.error(additionalConsole);
    throw new InternalServerErrorException('Internal server error: DDS.');
  }
}
