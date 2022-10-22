import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminSetup, AdminSetupModule } from '../src/services/admin-setup/admin-setup.module';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigModule } from '../src/config/app/app.config.module';
import { ContractsConnectorModule } from '../src/services/connectors/contracts/contracts.connector.module';
import { createLocalProvider } from './local-chain/local-provider';
import { AppConfigService } from '../src/config/app/app.config.service';

const clearAdminWallet = () => {
  const filePath = path.join(__dirname, '..', 'test-adminSetup.json');
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

describe('AdminSetupModule', () => {
  let app: INestApplication;
  let adminSetup: AdminSetup;

  beforeAll(() => {
    clearAdminWallet();
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppConfigModule,
        ContractsConnectorModule.forRootAsync({ contracts: ['accounts', 'document'] }),
        AdminSetupModule,
      ],
    })
      .overrideProvider('CHAIN_PROVIDER')
      .useFactory({
        inject: [AppConfigService],
        factory: (cs: AppConfigService) => {
          return createLocalProvider({
            ganacheOptions: {
              chain: {
                chainId: cs.BLOCKCHAIN_CHAIN_ID,
                hardfork: 'byzantium',
                networkId: cs.BLOCKCHAIN_CHAIN_ID,
                vmErrorsOnRPCResponse: false,
              },
            },
          });
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('with FROM_FILE strategy, should create admin setup file if not exists', () => {
    adminSetup = app.get('ADMIN_SETUP');
    expect(adminSetup).toHaveProperty('accountsAddress');
    expect(adminSetup).toHaveProperty('adminWallet');
    expect(adminSetup).toHaveProperty('adminWallet.address');
    expect(adminSetup).toHaveProperty('adminWallet.privateKey');
    expect(adminSetup).toHaveProperty('adminWallet.publicKey');
  });

  it('with FROM_FILE strategy, should reuse admin setup from file if it already exists', () => {
    const reusedSetup: AdminSetup = app.get('ADMIN_SETUP');
    expect(reusedSetup.accountsAddress).toEqual(adminSetup.accountsAddress);
    expect(reusedSetup.adminWallet.address).toEqual(adminSetup.adminWallet.address);
    expect(reusedSetup.adminWallet.publicKey).toEqual(adminSetup.adminWallet.publicKey);
    expect(reusedSetup.adminWallet.privateKey).toEqual(adminSetup.adminWallet.privateKey);
  });

  afterAll(() => {
    clearAdminWallet();
  });
});
