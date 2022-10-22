import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BigNumber, ethers, Wallet } from 'ethers';
import { stringToHash } from '../../helpers/hasher';
import { ContractsService } from '../../services/contracts/contracts.service';
import { IContractDeployed, IUnsignedTx } from '../../services/contracts/interface';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SignTxDto, UnsignedTxDto } from './dto/request/unsigned-tx.dto';
import { AdminSetup } from '../../services/admin-setup/admin-setup.module';

@Injectable()
export class AdminService {
  private readonly logger = new Logger('AdminService');

  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @Inject('ADMIN_SETUP') private adminSetup: AdminSetup,
    private usersService: UsersService,
    private contractsService: ContractsService
  ) {}

  /**
   *
   * Finds a user, including when tagged as 'deleted'.
   *
   */
  async findOne(id: string) {
    return this.usersService.findOne(id, false);
  }

  /**
   *
   * Finds all users, without any restrictions.
   *
   */
  findAll() {
    return this.usersService.findAll();
  }

  /**
   *
   * Updates a user. Any prop can be updated except id and emailHash (which derives from id).
   * This can thus be used to change the deleted tag.
   *
   */
  async update(id: string, attrs: Partial<User>) {
    const user = await this.findOne(id);
    const { id: _ignore1, emailHash: _ignore2, ...other } = attrs;
    Object.assign(user, other);

    const updatedUser = await this.repo.save(user);
    Object.keys(attrs).forEach(k =>
      this.logger.verbose(`Admin has updated user: ${updatedUser.id} [${k} = ${attrs[k]}] `)
    );
    return updatedUser;
  }

  /**
   *
   * Removes a user from db, not from cognito.
   * DANGER: this is a true delete, not just a delete tag set to true.
   *
   */
  async removeUserFromDatabase(id: string) {
    const user = await this.findOne(id);
    //repo.delete would work but would ignore entity hooks like AfterRemove
    const removedUser = await this.repo.remove(user);

    this.logger.verbose(`Admin has completely removed user ${removedUser.id} from database`);
    return removedUser;
  }

  /**
   *
   * Creates the user in database only (ignoring cognito)
   *
   */
  async createUserInDatabase(email: string) {
    const exists = await this.usersService.userExists(email, false);
    if (exists) throw new ConflictException('user already exists');

    const emailHash = stringToHash(email);

    const user = this.repo.create({ id: email, emailHash, deleted: false });
    const createdUser = await this.repo.save(user);

    this.logger.verbose(`Admin has enforced user creation in DB only: ${createdUser.id}`);
    return createdUser;
  }

  /**
   *
   * Deploys Accounts smart contract, using admin wallet.
   *
   */
  async deployAccountsContract(): Promise<IContractDeployed> {
    const txRequest = await this.contractsService.createUnsignedContract({
      contractName: 'accounts',
      from: this.adminSetup.adminWallet.address,
    });

    const signer = this.adminSetup.adminWallet.connect(this.contractsService.getProvider());
    const signed = await signer.signTransaction(txRequest);
    const { from, transactionHash, contractAddress } = await this.contractsService.forwardSignedTx('accounts', signed);

    this.logger.verbose(
      `Admin has deployed an Accounts contract on chain. [Tx hash = ${transactionHash}] [Contract address = ${contractAddress}]`
    );
    return { from, transactionHash, contractAddress };
  }

  /**
   *
   * Signs an unsigned tx with a mnemonic or a private key.
   * The unsigned tx may be one created manually or one created with ethers popultate helper.
   * The unsigned tx can be serialized (stringified) or not.
   *
   */
  async signTx(signTxDto: SignTxDto): Promise<string> {
    const { mnemonic, privateKey, unsignedTx: rawUnsignedTx } = signTxDto;

    if (!mnemonic && !privateKey) throw new BadRequestException('Need either a mnemonic or a private key');

    let unsignedTx: IUnsignedTx;
    try {
      unsignedTx = this.parseUnsignedTx(rawUnsignedTx);
    } catch (_e) {
      this.logger.verbose(`SignTx : Cannot parse unsigned tx.`);
      throw new BadRequestException('unsigned tx seems malformed');
    }

    let wallet: ethers.Wallet;
    if (mnemonic) {
      try {
        wallet = ethers.Wallet.fromMnemonic(mnemonic);
      } catch (_e) {
        this.logger.verbose(`SignTx : Cannot create wallet with the supplied mnemonic.`);
        throw new BadRequestException('mnemonic is not valid');
      }
    } else {
      try {
        wallet = wallet = new Wallet(privateKey);
      } catch (_e) {
        this.logger.verbose(`SignTx : Cannot create wallet with the supplied private key.`);
        throw new BadRequestException('private key is not valid');
      }
    }

    const signer = wallet.connect(this.contractsService.getProvider());

    let signed: string;
    try {
      signed = await signer.signTransaction(unsignedTx);
    } catch (e) {
      this.logger.warn(`SignTx : Failed to sign tx. See stack below:`);
      console.log(e);
      throw new BadRequestException('Unable to sign tx.');
    }
    return signed;
  }

  /**
   *
   * Parses a serialized (stringified) unsigned tx to an unsigned tx object.
   * If the input is already parsed, returns it.
   *
   */
  parseUnsignedTx(rawUnsignedTx: UnsignedTxDto): IUnsignedTx {
    let { gasLimit, gasPrice } = rawUnsignedTx;

    const toBigNumber = (value: any) => {
      // case1 : value is already in expected ethers format
      if (value.type && value.type === 'BigNumber') {
        return BigNumber.from(value.hex);
      } else {
        //case2: value can be converted to BigNumber (string, hexstring, number, ...)
        return BigNumber.from(value);
      } //any other case will throw
    };

    gasLimit = toBigNumber(gasLimit);
    gasPrice = toBigNumber(gasPrice);

    return { ...rawUnsignedTx, gasLimit, gasPrice };
  }

  /**
   *
   * Gets all accounts from Accounts smart contract
   *
   */
  async allAccounts() {
    const contract = this.contractsService.getContractInstance('accounts', this.adminSetup.accountsAddress);
    return await contract.getAccounts();
  }
}
