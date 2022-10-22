import { Logger, Module } from '@nestjs/common';
import { Wallet } from 'ethers';
// import { AppConfigModule } from '../../config/app/app.config.module';
import { AdminSetupStrategy, AppConfigService, Environment } from '../../config/app/app.config.service';
import * as fs from 'fs';
import * as path from 'path';
import { ContractsService } from '../contracts/contracts.service';
import { ContractsModule } from '../contracts/contracts.module';
import { IContractDeployed } from '../contracts/interface';

export interface AdminSetup {
  adminWallet: Wallet;
  accountsAddress: string;
}

/**
 *
 * Deploys Accounts smart contract, using admin wallet.
 *
 */
async function deployAccountsContract(
  contractsService: ContractsService,
  adminWallet: Wallet
): Promise<IContractDeployed> {
  const logger = new Logger('deployAccountsContract');

  const txRequest = await contractsService.createUnsignedContract({
    contractName: 'accounts',
    from: adminWallet.address,
  });

  const signer = adminWallet.connect(contractsService.getProvider());
  const signed = await signer.signTransaction(txRequest);
  const { from, transactionHash, contractAddress } = await contractsService.forwardSignedTx('accounts', signed);

  logger.verbose(
    `Admin has deployed an Accounts contract on chain. [Tx hash = ${transactionHash}] [Contract address = ${contractAddress}]`
  );
  return { from, transactionHash, contractAddress };
}

async function provideAdminSetup(config: AppConfigService, contractsService: ContractsService): Promise<AdminSetup> {
  const logger = new Logger('provideAdminSetup');
  logger.verbose(`Admin setup strategy is ${config.ADMIN_SETUP_STRATEGY}.`);

  switch (config.ADMIN_SETUP_STRATEGY) {
    case AdminSetupStrategy.FROM_ENV: {
      const adminWallet = new Wallet(config.ADMIN_WALLET_PRIVATE_KEY);
      const accountsAddress = config.ADMIN_CONTRACT_ACCOUNTS;
      logger.verbose(`Admin setup retrieved from environment variables.`);
      return { adminWallet, accountsAddress };
    }

    case AdminSetupStrategy.FROM_FILE: {
      const setupFilePath =
        config.NODE_ENV === Environment.Test
          ? path.join(__dirname, '..', '..', '..', 'test-adminSetup.json')
          : path.join(__dirname, '..', '..', '..', 'adminSetup.json');

      if (fs.existsSync(setupFilePath)) {
        const fileContent = fs.readFileSync(setupFilePath, { encoding: 'utf8' });
        try {
          const obj = JSON.parse(fileContent);

          if (obj.ADMIN_WALLET_PRIVATE_KEY && obj.ADMIN_CONTRACT_ACCOUNTS) {
            const adminWallet = new Wallet(obj.ADMIN_WALLET_PRIVATE_KEY);
            const accountsAddress = obj.ADMIN_CONTRACT_ACCOUNTS;
            logger.verbose(`Admin setup retrieved from "${setupFilePath}".`);
            return { adminWallet, accountsAddress };
          } else {
            throw new Error('I will be rethrow');
          }
        } catch (e) {
          // catch both parse errors and missing keys
          throw new Error(
            `ADMIN_SETUP_STRATEGY is "FROM_FILE" but file at path "${setupFilePath}" is empty, incomplete or not a valid JSON.`
          );
        }
      } else {
        logger.verbose(`Admin setup does not exist yet. Creating...`);
        const adminWallet = Wallet.createRandom();
        const { contractAddress: accountsAddress } = await deployAccountsContract(contractsService, adminWallet);
        const setupObj = {
          ADMIN_WALLET_PRIVATE_KEY: adminWallet.privateKey,
          ADMIN_CONTRACT_ACCOUNTS: accountsAddress,
        };
        fs.writeFileSync(setupFilePath, JSON.stringify(setupObj));
        logger.verbose(`Admin setup created and saved at "${setupFilePath}".`);
        return { adminWallet, accountsAddress };
      }
    }

    default:
      throw new Error(`${config.ADMIN_SETUP_STRATEGY} is not implemented.`);
  }
}

const adminSetupFactory = {
  provide: 'ADMIN_SETUP',
  inject: [AppConfigService, ContractsService],
  useFactory: async (config: AppConfigService, contractsService: ContractsService) =>
    await provideAdminSetup(config, contractsService),
};

@Module({
  imports: [ContractsModule], // AppConfigModule is global, so no import
  providers: [adminSetupFactory],
  exports: [adminSetupFactory],
})
export class AdminSetupModule {}
