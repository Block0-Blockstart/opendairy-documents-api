import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/app/app.config.service';
import { AuthConnectorService } from '../../services/connectors/auth/auth.connector.service';
import { ContractsService } from '../../services/contracts/contracts.service';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const users: User[] = [
    { id: 'test1@test.com', lastNonceUsed: 0, deleted: false } as User,
    { id: 'test2@test.com', lastNonceUsed: 0, deleted: true } as User,
  ];
  const getUser = (id: string): User => users.filter(u => u.id === id)[0];

  beforeEach(async () => {
    const fakeUsersRepository = {
      findOneBy: ({ id }) => Promise.resolve(getUser(id)),
      create: ({ id, emailHash, lastNonceUsed, deleted }) =>
        Promise.resolve({ id, emailHash, lastNonceUsed, deleted } as User),
      save: (user: User) =>
        Promise.resolve({
          id: user.id,
          emailHash: user.emailHash,
          lastNonceUsed: user.lastNonceUsed,
          deleted: user.deleted,
        } as User),
    };

    const fakeAuthConnectorService: Partial<AuthConnectorService> = {
      signup: (_email, _password) =>
        Promise.resolve({ data: { username: 'abc', pool: { userPoolId: 'abc', clientId: 'abc' } }, error: null }),
    };

    const fakeContractsService: Partial<ContractsService> = {};

    const fakeAppConfigService: Partial<AppConfigService> = {};

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: fakeUsersRepository },
        { provide: AuthConnectorService, useValue: fakeAuthConnectorService },
        { provide: ContractsService, useValue: fakeContractsService },
        { provide: AppConfigService, useValue: fakeAppConfigService },
        { provide: 'ADMIN_SETUP', useValue: {} },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('can create an instance of users service', async () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('throws when creating a user existing in DB', async () => {
      await expect(service.create('test1@test.com', 'Test@1234')).rejects.toThrow(ConflictException);
    });

    it('creates a user', async () => {
      const user = await service.create('testNew@test.com', 'Test@1234');
      expect(user).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('throws when user not exists', async () => {
      await expect(service.findOne('janeDoe@test.com', true)).rejects.toThrow(NotFoundException);
    });

    it('returns a user when user exists', async () => {
      const user = await service.findOne('test1@test.com', true);
      expect(user).toBeDefined();
    });

    it('throws when user exists but is marked deleted and deleted tags are ignored', async () => {
      await expect(service.findOne('test2@test.com', true)).rejects.toThrow(NotFoundException);
    });

    it('returns a user when user exists but is marked deleted and deleted tags are not ignored', async () => {
      const user = await service.findOne('test2@test.com', false);
      expect(user).toBeDefined();
    });
  });
});
