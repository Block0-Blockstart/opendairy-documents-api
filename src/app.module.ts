import { Module, ValidationPipe } from '@nestjs/common';
import { AppConfigModule } from './config/app/app.config.module';
import { AdminSetupModule } from './services/admin-setup/admin-setup.module';
import { TypeOrmConfigService } from './config/typeorm/data-source';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsConnectorModule } from './services/connectors/contracts/contracts.connector.module';
import { UsersModule } from './models/users/users.module';
import { AdminModule } from './models/admin/admin.module';
import { DocumentsModule } from './models/documents/documents.module';
import { APP_PIPE } from '@nestjs/core';
// backup alternative for typeorm connection
// import { appDataSourceOptions } from './data-source';

@Module({
  imports: [
    AppConfigModule,
    AdminSetupModule,
    // TypeOrmModule.forRoot(appDataSourceOptions),
    TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService }),
    /*
     * Currently, ContractsConnectorModule is designed to fetch all the contracts patterns
     * from the contracts API at once. This is the most effective.
     * The only purpose of this module is to fetch the contracts patterns. It can be
     * replaced by an other module as well as it sticks to the return type.
     * For example, it can be replaced by a module providing the patterns locally instead of
     * fetching them.
     * To avoid unneccesary re-fetch, we recommend to let this module global (by default).
     * If you know what you do, you can enforce this module to NOT be global by passing this option:
     *     ContractsConnectorModule.forRootAsync({
     *        isGlobal: false,
     *        contracts: ['your contract'],
     *     }
     */
    ContractsConnectorModule.forRootAsync({ contracts: ['accounts', 'document'] }),
    UsersModule,
    DocumentsModule,
    AdminModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      //whitelist true means that extra props (not included in DTOs) are removed from body/params before reaching our controllers
      useValue: new ValidationPipe({ whitelist: true }),
    },
  ],
})
export class AppModule {}
