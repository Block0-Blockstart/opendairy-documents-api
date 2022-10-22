import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ContractsConnectorModule } from '../src/services/connectors/contracts/contracts.connector.module';
import { AppConfigModule } from '../src/config/app/app.config.module';
import { AppConfigService } from '../src/config/app/app.config.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../src/models/users/users.module';
import { AdminModule } from '../src/models/admin/admin.module';
import { TypeOrmConfigService } from '../src/config/typeorm/data-source';
import { DocumentsModule } from '../src/models/documents/documents.module';
import { APP_PIPE } from '@nestjs/core';
import { AdminSetupModule } from '../src/services/admin-setup/admin-setup.module';
import * as fs from 'fs';
import * as path from 'path';
import { createLocalProvider } from './local-chain/local-provider';

const clearAdminWallet = () => {
  const filePath = path.join(__dirname, '..', 'test-adminSetup.json');
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    clearAdminWallet();
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppConfigModule,
        TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService }),
        ContractsConnectorModule.forRootAsync({ contracts: ['accounts', 'document'] }),
        UsersModule,
        DocumentsModule,
        AdminModule,
        AdminSetupModule,
      ],
      providers: [
        {
          provide: APP_PIPE,
          useValue: new ValidationPipe({ whitelist: true }),
        },
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

  // it.todo('should pass');

  it('should have env var NODE_ENV', () => {
    const v = app.get(AppConfigService).NODE_ENV;
    expect(v).toBeDefined();
  });

  it('should have env var API_CONTRACTS_FULL_URL', () => {
    const v = app.get(AppConfigService).API_CONTRACTS_FULL_URL;
    expect(v).toBeDefined();
  });

  it('/admin/contract/create-accounts (POST)', () => {
    const pk = app.get('ADMIN_SETUP').adminWallet.privateKey;
    return request(app.getHttpServer())
      .post('/admin/contract/create-accounts')
      .set('odadm', pk)
      .expect(201)
      .then(res => {
        const parsed = JSON.parse(res.text);
        expect(parsed).toHaveProperty('from');
        expect(parsed).toHaveProperty('transactionHash');
        expect(parsed).toHaveProperty('contractAddress');
      });
  });

  afterAll(() => {
    clearAdminWallet();
  });
  // this results in tests crashing
  // afterAll(async () => {
  //   await app.close();
  // });
});
