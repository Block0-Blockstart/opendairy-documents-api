import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { errors, ethers } from 'ethers';
import { FormatTypes } from 'ethers/lib/utils';
import { AppConfigService } from '../../config/app/app.config.service';
import { notNullish } from '../../helpers/comparators';
import { removeNullBytes } from '../../helpers/strings';
import { IContractPattern } from '../connectors/contracts/interfaces';
import {
  IDefaultTxParams,
  ICreateUnsignedTxArgs,
  IUnsignedTx,
  ICreateUnsignedContractArgs,
  IEthersError,
  ICheckSignedTx,
  ICheckSignedDeployTx,
  IReadContractStorage,
} from './interface';

@Injectable()
export class ContractsService {
  private defaultTxParams: IDefaultTxParams;
  private availableContracts: Array<string>;
  private logger = new Logger('ContractsService');

  constructor(
    //Injected from global module ContractsConnectorModule
    @Inject('CONTRACT_PATTERNS') private contractsPatterns: Record<string, IContractPattern>,
    @Inject('CHAIN_PROVIDER') private chainProvider: ethers.providers.JsonRpcProvider | ethers.providers.Web3Provider,
    private config: AppConfigService
  ) {
    this.defaultTxParams = {
      chainId: this.config.BLOCKCHAIN_CHAIN_ID,
      gasPrice: this.config.BLOCKCHAIN_TX_GAS_PRICE,
      gasLimit: this.config.BLOCKCHAIN_TX_GAS_LIMIT,
      type: this.config.BLOCKCHAIN_TX_TYPE,
    };
    this.availableContracts = Object.keys(this.contractsPatterns);

    this.checkProvider()
      .then(info => this.logger.log(info))
      .catch(e => {
        this.logger.error(e.message || 'jsonRpc connection failed.');
        process.exit(1);
      });
  }

  /**
   *
   * Returns the provider used by this service.
   *
   */
  getProvider() {
    return this.chainProvider;
  }

  /**
   *
   * Returns all patterns available
   *
   */
  getPatterns(): Record<string, IContractPattern> {
    return this.contractsPatterns;
  }

  /**
   *
   * Returns { name, abi, bytecode } for the given contractName.
   * If this contractName is not known by this service, app will throw.
   *
   */
  getPattern(contractName: string): IContractPattern {
    this.contractExistsOrThrow(contractName);
    return this.contractsPatterns[contractName.toLowerCase()];
  }

  /**
   *
   * Returns an ethers Contract instance for this contractName. The instance
   * is linked to the given address and to a jsonRpc provider.
   * You still need to connect the contract to a signer if you need to sign
   * transactions. WARNING: this function will NOT
   *  * check the address.
   *  * check if the contract name matches the contract deployed at the given address.
   *
   */
  getContractInstance(contractName: string, address: string) {
    this.contractExistsOrThrow(contractName);
    return new ethers.Contract(address, this.contractsPatterns[contractName.toLowerCase()].abi, this.chainProvider);
  }

  /**
   *
   * Creates an unsigned transaction for the given contractName.
   * The generated tx is populated and ready to be signed.
   *
   */
  async createUnsignedTx({ contractName, fn, fnParams, from, to }: ICreateUnsignedTxArgs): Promise<IUnsignedTx> {
    this.contractExistsOrThrow(contractName);

    try {
      const nonce = await this.chainProvider.getTransactionCount(from);
      const contract = new ethers.Contract(to, this.getPattern(contractName).abi, this.chainProvider);
      const { data } =
        fnParams && fnParams.length && fnParams.length > 0
          ? await contract.populateTransaction[fn](...fnParams)
          : await contract.populateTransaction[fn]();

      return { ...this.defaultTxParams, data, from, to, nonce };
    } catch (e) {
      this.manageEthersErrors(e, true);
    }
  }

  /**
   *
   * Creates an unsigned transaction for given contractName deployment.
   * The generated tx is populated and ready to be signed by the contract's owner.
   *
   */
  async createUnsignedContract({ contractName, ctorParams, from }: ICreateUnsignedContractArgs): Promise<IUnsignedTx> {
    this.contractExistsOrThrow(contractName);

    try {
      const nonce = await this.chainProvider.getTransactionCount(from);
      const { abi, bytecode } = this.contractsPatterns[contractName];
      const factory = new ethers.ContractFactory(abi, bytecode);
      const { data } =
        ctorParams && ctorParams.length && ctorParams.length > 0
          ? factory.getDeployTransaction(...ctorParams)
          : factory.getDeployTransaction();

      return { ...this.defaultTxParams, data, from, nonce };
    } catch (e) {
      this.manageEthersErrors(e, true);
    }
  }

  /**
   *
   * Sends a signed tx to the provider.
   *
   */
  async forwardSignedTx(contractName: string, signedTx: string) {
    this.contractExistsOrThrow(contractName);

    let txResponse: ethers.providers.TransactionResponse;
    try {
      txResponse = await this.chainProvider.sendTransaction(signedTx);
    } catch (e) {
      await this.manageEthersErrors(e);
    }

    let txReceipt: ethers.providers.TransactionReceipt;
    try {
      txReceipt = await txResponse.wait();
    } catch (e) {
      await this.manageEthersErrors(e);
    }
    return txReceipt;
  }

  /*
   *
   * Make a simple call to any smart contract function
   *
   */
  async callContractFunction({ contractName, fnName, fnParams, address }: IReadContractStorage): Promise<any> {
    const contract = new ethers.Contract(address, this.getPattern(contractName).abi, this.chainProvider);
    const data =
      fnParams && fnParams.length && fnParams.length > 0
        ? await contract[fnName](...fnParams)
        : await contract[fnName]();
    return data;
  }

  /**
   *
   * Try to parse a signed tx.
   *
   */
  parseSignedTx(signedTx: string) {
    try {
      const { nonce, from, to, chainId, data } = ethers.utils.parseTransaction(signedTx);
      return { nonce, from, to, chainId, data };
    } catch (e) {
      throw new Error('Cannot parse transaction.');
    }
  }

  /**
   *
   * Unpacks and decodes a signedTx, then checks decoded properties
   * against values provided. Values currently supported are:
   * * nonce: the nonce the tx should have
   * * from: the sender address the tx should have
   * * to: the receiver address the tx should have
   * * fn: the contract function that should be called by this tx
   * * * fn:contractName: the name of the contract abi
   * * * fn:fnName: the name of the function
   * * * fn:fnArgNames: array containing names of function arguments to check
   * * * fn:fnArgValues: array containing values for function arguments names
   *
   * * [Note: the chainId is always checked.]
   * * [Note: throwOnFirstError is false by default. If set to true, this function will throw on first verification error.]
   *
   */
  checkSignedTx({
    signedTx,
    nonce: expectedNonce,
    from: expectedFrom,
    to: expectedTo,
    fn: expectedFn,
    throwOnFirstError = false,
  }: ICheckSignedTx) {
    const expectedChainId = this.config.BLOCKCHAIN_CHAIN_ID;
    const errors: string[] = [];
    let nonce: number;
    let from: string;
    let to: string;
    let chainId: number;
    let data: string;

    try {
      ({ nonce, from, to, chainId, data } = ethers.utils.parseTransaction(signedTx));
    } catch (e) {
      //always throw immediately on this one
      throw new Error('Cannot parse transaction.');
    }

    if (expectedChainId !== chainId) {
      errors.push(`Unexpected value [to]. Expected ${expectedChainId} / received ${chainId}.`);
      if (throwOnFirstError) {
        throw new Error(errors.join(` - `));
      }
    }

    if (notNullish(expectedNonce) && expectedNonce !== nonce) {
      errors.push(`Unexpected value [nonce]. Expected ${expectedNonce} / received ${nonce}.`);
      if (throwOnFirstError) {
        throw new Error(errors.join(` - `));
      }
    }

    if (notNullish(expectedFrom) && expectedFrom !== from) {
      errors.push(`Unexpected value [from]. Expected "${expectedFrom}" / received "${from}".`);
      if (throwOnFirstError) {
        throw new Error(errors.join(` - `));
      }
    }

    if (notNullish(expectedTo) && expectedTo !== to) {
      errors.push(`Unexpected value [to]. Expected "${expectedTo}" / received "${to}".`);
      if (throwOnFirstError) {
        throw new Error(errors.join(` - `));
      }
    }

    if (notNullish(expectedFn)) {
      const { contractName, fnName, fnArgNames, fnArgValues } = expectedFn;
      let decoded: ethers.utils.TransactionDescription;

      try {
        const itf = new ethers.utils.Interface(this.getPattern(contractName).abi);
        decoded = itf.parseTransaction({ data });
      } catch (e) {
        errors.push(`Cannot decode transaction data.`);
        throw new Error(errors.join(` - `));
      }

      if (decoded.name !== fnName) {
        errors.push(`Unexpected value [fnName]. Expected "${fnName}" / received "${decoded.name}".`);
        if (throwOnFirstError) {
          throw new Error(errors.join(` - `));
        }
      }

      if ((fnArgNames && !fnArgValues) || (!fnArgNames && fnArgValues)) {
        errors.push(`If fnArgNames is provided, fnArgValues MUST be provided. And conversely.`);
        //always throw immediately on this one
        throw new Error(errors.join(` - `));
      }

      if (fnArgNames && fnArgNames.length !== fnArgValues.length) {
        // eslint-disable-next-line prettier/prettier
        errors.push(`Number of fnArgNames must match number of fnArgValues. fnArgNames[${fnArgNames.length}] !== fnArgValues[${fnArgValues.length}]`);
        //always throw immediately on this one
        throw new Error(errors.join(` - `));
      }

      if (fnArgNames) {
        for (let i = 0; i < fnArgNames.length; i++) {
          if (decoded.args[fnArgNames[i]] !== fnArgValues[i]) {
            // eslint-disable-next-line prettier/prettier
            errors.push(`Unexpected value [fnArgName at index ${i}]. Expected "${fnArgNames[i]}": "${fnArgValues[i]}" / received "${fnArgNames[i]}": "${decoded.args[fnArgNames[i]]}"`);
            if (throwOnFirstError) {
              throw new Error(errors.join(` - `));
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(` - `));
    }
  }

  /**
   *
   * Unpacks and decodes a signedTx, then checks decoded properties
   * against values provided. Values currently supported are:
   * * nonce: the nonce the tx should have
   * * from: the sender address the tx should have
   *
   * * [Note: the chainId is always checked.]
   * * [Note: throwOnFirstError is false by default. If set to true, this function will throw on first verification error.]
   *
   */
  checkSignedDeployTx({ signedTx, nonce, from, throwOnFirstError }: ICheckSignedDeployTx) {
    // TODO: Maybe add a check specific for contract deployment, allowing to verify
    // if the deployed abi matches the expected abi for this
    return this.checkSignedTx({ signedTx, nonce, from, throwOnFirstError });
  }

  /**
   *
   * Helper that returns a simplified contract ABI as a string.
   *
   */
  contractToString(contractName: string) {
    this.contractExistsOrThrow(contractName);
    const IContract = new ethers.utils.Interface(this.contractsPatterns[contractName.toLowerCase()].abi);
    return IContract.format(FormatTypes.full);
  }

  /**
   *
   *
   */
  private contractExists(contractName: string): boolean {
    return this.availableContracts.includes(contractName);
  }

  /**
   *
   *
   */
  private contractExistsOrThrow(contractName: string): void {
    if (!this.contractExists(contractName))
      throw new Error(`ContractsService: trying to use contract ${contractName} but this contract is unknown.`);
  }

  /**
   *
   *
   */
  private withMoreNetworkNames(network: ethers.providers.Network): ethers.providers.Network {
    let name: string;
    switch (network.chainId) {
      case 83584648538:
        name = 'Alastria T Network';
        break;
      case 2020:
        name = 'Alastria B Network';
        break;
      default:
        name = network.name;
    }
    return { ...network, name };
  }

  /**
   *
   *
   */
  private async checkProvider() {
    /*
     * const { chainId, name } = this.withMoreNetworkNames(await this.provider.ready);
     * "provider.ready" will retry forever when receiving a 'no network' error.
     * In former versions, we used this code. It solves issues when blockchain node is
     * launched after this api. But it also has a bad consequence, as it prevents from
     * easily detecting offline network. We encountered an Alastria failure in augustus 2022
     * and the backend kept trying to connect without warning us of the network failure.
     * As a consequence, we now crash the app at launching time when network is offline or
     * is an unexpected network
     */
    const { chainId, name } = this.withMoreNetworkNames(await this.chainProvider.getNetwork()); // will throw on noNetwork event

    const lastBlock = await this.chainProvider.getBlockNumber();
    const gasPrice = await this.chainProvider.getGasPrice();

    if (this.defaultTxParams.chainId !== chainId)
      throw new Error(
        `ContractsService: The chainId injected from environment variable does not match the chainId of the provider: ${this.defaultTxParams.chainId} versus ${chainId}`
      );

    if (!this.defaultTxParams.gasPrice.eq(gasPrice))
      throw new Error(
        'ContractsService: The gasPrice injected from environment variable does not match the gasPrice retrieved from the provider'
      );

    return `ContractsService: [Provider Infos] Blockchain: '${name}', Chain ID: '${chainId}', Last block mined: '${lastBlock}', Gas price: '${gasPrice}'`;
  }

  /**
   *
   *
   */
  private async manageEthersErrors(ee: IEthersError, creationTime = false): Promise<void> {
    if (!ee.code) {
      this.logger.error('Unexpected non-ethers error in ethers error manager');
      throw ee;
    }
    switch (ee.code) {
      ///////////////////////////////////////////////////////////
      /// Fatal errors.
      /// If this happens, developers have missed something.
      /// This is a bug to fix !
      ///////////////////////////////////////////////////////////

      case errors.UNKNOWN_ERROR:
      case errors.BUFFER_OVERRUN:
      case errors.MISSING_NEW:
      case errors.NOT_IMPLEMENTED:
      case errors.NUMERIC_FAULT:
      case errors.UNSUPPORTED_OPERATION:
      // We fix the gasLimit manually, so this should never happen.
      case errors.UNPREDICTABLE_GAS_LIMIT:
      // Gas is free, so it should never happen.
      case errors.INSUFFICIENT_FUNDS:
      // The replacement fee for the transaction is too low
      // We do not support replacements, so this should not happen.
      // If it happens, it means we have allowed repeating a tx that is currently pending.
      // And it should be fixed.
      case errors.REPLACEMENT_UNDERPRICED:
      // Idem, we do not support replacements, so this should not happen.
      case errors.TRANSACTION_REPLACED: {
        this.logger.error('Fatal error. Bug to fix.');
        throw ee;
      }

      ///////////////////////////////////////////////////////////
      /// Errors from provider.
      /// If this happens, the provider is probably unreachable.
      /// This is a bug to fix, but probably on the provider side !
      /// We should mention an internal error, but not crash.
      ///
      /// Addendum: sometimes, ethers does not catch nonce errors
      /// and throws a server error instead.So we need to check,
      /// and it's nested very deeply !
      ///////////////////////////////////////////////////////////

      case errors.SERVER_ERROR: {
        if (
          ee.reason === 'processing response error' &&
          ee.error &&
          ee.error.data &&
          ee.error.data.stack &&
          ee.error.data.stack.split &&
          ee.error.data.stack.split("doesn't have the correct nonce").length > 1
        ) {
          throw new BadRequestException(`${ee.code}: bad nonce`);
        } else {
          this.logger.error('Error with rpc provider. See stack below: ');
          console.log(ee);
          throw new InternalServerErrorException();
        }
      }

      case errors.NETWORK_ERROR:
      case errors.TIMEOUT: {
        this.logger.error('Error with rpc provider. See stack below: ');
        console.log(ee);
        throw new InternalServerErrorException();
      }

      ///////////////////////////////////////////////////////////
      /// Bad requests.
      /// Cannot be retried: will always fail if the request stays unchanged.
      /// Consumer is faulthy and may fix this.
      ///////////////////////////////////////////////////////////

      // Nonce has already been used. Consumer app can retry with higher nonce.
      case errors.NONCE_EXPIRED: {
        throw new BadRequestException(`${ee.code}: ${ee.reason}`);
      }

      case errors.CALL_EXCEPTION: {
        // This error needs further analysis. Ethers is expected to join the failed tx to the error.
        if (!ee.transaction || !ee.transaction.hash) {
          throw new BadRequestException(`${ee.code}. Impossible to get the reason why the tx failed.`);
        }

        let failedTx: ethers.providers.TransactionResponse;
        try {
          failedTx = await this.chainProvider.getTransaction(ee.transaction.hash);
        } catch (e) {
          this.logger.error(`Crashed when trying to fetch transaction with hash ${ee.transaction.hash}`);
          throw e;
        }

        if (!failedTx) {
          this.logger.error(`Unexpected undefined Tx with hash ${ee.transaction.hash}`);
          throw new Error(`Unexpected undefined Tx with hash ${ee.transaction.hash}`);
        }

        let code: string;
        try {
          code = await this.chainProvider.call(failedTx, failedTx.blockNumber);
        } catch (e) {
          this.logger.error(`Crashed when trying to replay failed transaction with hash ${ee.transaction.hash}`);
          throw e;
        }

        this.logger.verbose(`Replaying tx to detect error reason. Retrieved tx code is: '${code}'`);
        const reason = removeNullBytes(ethers.utils.toUtf8String('0x' + code.substring(138)));
        this.logger.verbose(`Found error reason for tx (hash=${ee.transaction.hash}). Reason is ${reason}`);
        //assuming that at this point, a failure is caused by a revert, for which the client is responsible and needs to know it
        throw new BadRequestException(reason);
      }

      ///////////////////////////////////////////////////////////
      /// Edge cases.
      /// These errors depends on the moment they are thrown.
      /// If thrown when WE CREATE THE (UNSIGNED) TRANSACTION,
      /// we are responsible and they are Fatal errors, requiring bug fix.
      /// But if they are thrown when WE FORWARD THE (SIGNED) TRANSACTION
      /// it means that the sender or a hacker has somehow broken the transaction,
      /// by mistake or by purpose(e.g. trying to modify some props after it is
      /// signed, or adding an arg that does not exist on function).
      ///////////////////////////////////////////////////////////

      // Invalid argument to a function (e.g. value is incompatible with type).
      // This should not happen here and SHOULD be checked before
      case errors.INVALID_ARGUMENT:
      // Missing argument to a function (e.g. expected 2 args, received 1).
      // This should not happen here and SHOULD be checked before
      case errors.MISSING_ARGUMENT:
      // Too many arguments to a function (e.g. expected 2 args, received 3).
      // This should not happen here and SHOULD be checked before
      case errors.UNEXPECTED_ARGUMENT: {
        if (creationTime) {
          this.logger.error('Fatal error. Bug to fix.');
          throw ee;
        }
        this.logger.verbose(`A broken transaction has been submited to be forwarded.`);
        throw new BadRequestException(`${ee.code}. Signed transaction is broken.`);
      }

      // the error has a code, but none of the documented ethers codes
      default:
        this.logger.error('Unknown error. See below:');
        console.error(ee);
        throw ee;
    }
  }
}
