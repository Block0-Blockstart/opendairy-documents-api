import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { stringToHash } from '../../helpers/hasher';
import { AuthConnectorService } from '../../services/connectors/auth/auth.connector.service';
import { ContractsService } from '../../services/contracts/contracts.service';
import { Repository } from 'typeorm';
import { TxcRegisterEthAccountDto } from './dtos/request/txc-register-eth-account.dto';
import { TxfRegisterEthAccountDto } from './dtos/request/txf-register-eth-account.dto';
import { User } from './entities/user.entity';
import { AdminSetup } from '../../services/admin-setup/admin-setup.module';

@Injectable()
export class UsersService {
  private readonly logger = new Logger('UsersService');

  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @Inject('ADMIN_SETUP') private adminSetup: AdminSetup,
    private authConnector: AuthConnectorService,
    private contractsService: ContractsService
  ) {}

  /**
   *
   * Creates user in DB and cognito.
   * If the user already exists in DB, throws.
   * If the user already exists on Cognito, creates it in DB only.
   *
   */
  async create(email: string, password: string) {
    //should not exist, even if tagged 'deleted'
    const exists = await this.userExists(email, false);
    if (exists) throw new ConflictException('User already exists.');

    //create on Cognito
    const { error, data } = await this.authConnector.signup(email, password);

    if (!error) {
      this.logger.verbose(`User ${data.username} created on Cognito with:`);
      this.logger.verbose(`* userPoolId: ${data.pool.userPoolId}`);
      this.logger.verbose(`* clientId:${data.pool.clientId}`);
    }

    if (error) {
      if (error.code >= 500) {
        throw new InternalServerErrorException(error.message);
      } else if (error.message !== 'An account with the given email already exists.') {
        throw new BadRequestException(error.message);
      } else {
        this.logger.verbose(`User ${email} already exists on Cognito, but not in DB. Trying to create it...`);
      }
    }

    //create in DB
    const emailHash = stringToHash(email);
    const user = this.repo.create({ id: email, emailHash, lastNonceUsed: 0, deleted: false });
    const created = await this.repo.save(user);
    this.logger.verbose(`User ${created.id} created in database.`);
    return created;
  }

  /**
   *
   * Finds a user if it exists, throws if not exists.
   *
   * If 'ignoreDeleted' is true, a user tagged as deleted is considered not existing.
   *
   */
  async findOne(id: string, ignoreDeleted: boolean) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('user not found');
    if (ignoreDeleted && user.deleted) throw new NotFoundException('user not found');
    return user;
  }

  /**
   *
   * Note: for this prototype, any user can get the list of all users,
   * as we use this to list all available partners for document exchange.
   * (no deal management)
   *
   */
  findAll() {
    return this.repo.find();
  }

  /**
   *
   * These attrs will be ignored:
   * * id : because it is the primary key (remember that id IS the email)
   * * emailHash : because it derives from the id
   * * deleted : because it is used to tag removed user instead of true removal
   * * ethAddress: because the update process is managed through a specific process involving on-chain validation
   * * pubKey: because this is not supported, and if it was, it would derive from ethAddress
   * * lastNonceUsed: because it is an internal only value to manage txs.
   *
   * If 'ignoreDeleted' is true, a user tagged as deleted is considered not existing.
   *
   */
  async update(id: string, attrs: Partial<User>, ignoreDeleted: boolean) {
    const user = await this.findOne(id, ignoreDeleted);
    const {
      id: _ignore1,
      emailHash: _ignore2,
      deleted: _ignore3,
      ethAddress: _ignore4,
      pubKey: _ignore5,
      lastNonceUsed: _ignore6,
      ...other
    } = attrs;
    Object.assign(user, other);

    return this.repo.save(user);
  }

  async setLastNonceUsed(id: string, nonce: number) {
    const user = await this.findOne(id, true);
    Object.assign(user, { lastNonceUsed: nonce });
    return this.repo.save(user);
  }

  /**
   *
   * If user is already tagged as deleted, he is always considered
   * as not existing, so that he cannot be tagged again.
   *
   */
  async setDeleted(id: string) {
    const user = await this.findOne(id, true);
    Object.assign(user, { deleted: true });
    return this.repo.save(user);
  }

  /**
   *
   * Returns a serialized json of the unsigned tx required to
   * add user eth account.
   *
   * Note: this function expects that the user exists (previous check should be done with the AuthGuard).
   *
   */
  async txcRegisterEthAccount(user: User, { ethAddress, pubKey }: TxcRegisterEthAccountDto) {
    let emailHash = user.emailHash;

    // How could this happen ???
    if (!emailHash) {
      const recreatedEmailHash = stringToHash(user.id);
      Object.assign(user, { emailHash: recreatedEmailHash });
      await this.repo.save(user);
      emailHash = recreatedEmailHash;
    }

    const utx = await this.contractsService.createUnsignedTx({
      contractName: 'accounts',
      from: ethAddress,
      fn: 'addAccount',
      fnParams: [pubKey || 'Not Implemented', emailHash],
      to: this.adminSetup.accountsAddress,
    });

    await this.setLastNonceUsed(user.id, utx.nonce);

    //for whatever reason, Nest does not serialize this response automatically, so we do it
    return JSON.stringify(utx);
  }

  /**
   *
   * Forwards eth account creation tx to smart contract and
   * then adds the eth address on user (in DB).
   *
   */
  async txfRegisterEthAccount(user: User, { ethAddress, tx }: TxfRegisterEthAccountDto) {
    //check expected tx values
    try {
      this.contractsService.checkSignedTx({
        signedTx: tx,
        to: this.adminSetup.accountsAddress,
        from: ethAddress,
        nonce: user.lastNonceUsed,
        fn: {
          contractName: 'accounts',
          fnName: 'addAccount',
          fnArgNames: ['emailHash'],
          fnArgValues: [user.emailHash || 'user has no emailHash'],
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

    if (user.ethAddress) {
      throw new BadRequestException('User has already registered an ethereum account');
    }

    try {
      await this.contractsService.forwardSignedTx('accounts', tx);
      this.logger.verbose(
        `User ${user.id} has registered an Ethereum account in smart contract ${this.adminSetup.accountsAddress}.`
      );
    } catch (e) {
      // if error is that accounts already exists, it means that we have a
      // desynchronization issue: account exists on BC, but not in DB.
      // So, we skip this error and let the account be created in DB
      if (!e.message || !e.message.includes('account already exists')) {
        throw e;
      }
    }

    Object.assign(user, { ethAddress });
    const updated = await this.repo.save(user);
    this.logger.verbose(`Ethereum address for User ${user.id} saved in DB.`);
    return updated;
  }

  /**
   *
   * Checks if an email address matches an ethereum address (verified on chain)
   *
   */
  async checkAddress(email: string, address: string): Promise<boolean> {
    const c = this.contractsService.getContractInstance('accounts', this.adminSetup.accountsAddress);
    const [_addr, _pubKey, emailHash] = await c.getAccount(address);
    const user = await this.findOne(email, true);
    return emailHash === user.emailHash;
  }

  /**
   *
   * If 'ignoreDeleted' is true, users tagged as deleted will be considered NOT existing.
   *
   */
  async userExists(id: string, ignoreDeleted: boolean) {
    const user = await this.repo.findOneBy({ id });
    return ignoreDeleted ? user && !user.deleted : !!user;
  }
}
