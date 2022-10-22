import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Environment } from '../app/app.config.service';

config();

// Set synchronize to true only when you can accept to lose any part or even the whole database. This mode will adapt the DB according to entities definitions.
// Set synchronize to false in production. Also in dev, when you cannot risk to lose your database. You will need to use migrations to alter the database.
const defaultOpts = {
  synchronize: false,
  migrations: [__dirname + '/../../../migrations/*.js'],
};

const getDataSourceOpts = (): DataSourceOptions => {
  switch (process.env.NODE_ENV) {
    case Environment.Development:
      return {
        ...defaultOpts,
        type: 'sqlite',
        database: 'db-dev.sqlite',
        name: 'dbDevConnection',
        entities: ['**/*.entity.js'], //in dev, nest reads files after ts build, so it looks for plain js files
      };
    case Environment.Test:
      return {
        ...defaultOpts,
        type: 'sqlite',
        database: 'db-test.sqlite',
        name: 'dbTestConnection',
        entities: [__dirname + '/../../**/*.entity.ts'], //in tests, nest reads files before ts build, so it looks for original ts files
        migrations: [__dirname + '/../../../migrations/*.ts'],
        migrationsRun: true,
      };
    case Environment.Production:
      return {
        ...defaultOpts,
        type: 'sqlite',
        database: 'db-prototype.sqlite', // should be replaced by OpenDairy Postgres DB, with access credentials
        name: 'dbPrototypeConnection',
        entities: ['**/*.entity.js'],
        migrationsRun: true,
      };
    default:
      throw new Error('Unknown environment. NODE_ENV should be development, test or production.');
  }
};

// required by @nestjs/typeorm to init and then inject the connection
@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  createTypeOrmOptions() {
    return getDataSourceOpts();
  }
}

// required by typeorm CLI to create and run migrations (must be the default export)
export default new DataSource(getDataSourceOpts());
