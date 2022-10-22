import { DynamicModule, Logger, Module } from '@nestjs/common';
import { IContractPattern, IContractsConnectorModuleOptions } from './interfaces';
import { AxiosModule } from '../../axios/axios.module';
import { AxiosService } from '../../axios/axios.service';
import { AppConfigService } from '../../../config/app/app.config.service';

const provideContracts = async (contracts: Array<string>, config: AppConfigService, ax: AxiosService) => {
  // friendly reminder: using get params requires that the url ends with '/', to render my-url/?key=value
  const url = config.API_CONTRACTS_FULL_URL;
  const logger = new Logger('provideContracts');

  const errors = [];
  const contractsPatterns: Record<string, IContractPattern> = {};

  const fetchOne = async (name: string) => {
    const { data, error } = await ax.sendRequest<IContractPattern>({ url, method: 'GET', params: { name } });
    if (error) errors.push(error.message);
    else contractsPatterns[data.name] = data;
  };

  await Promise.all(contracts.map(async contract => await fetchOne(contract)));

  // Crash the app, as contracts patterns are essentials
  if (errors.length > 0) throw new Error(errors.toString());
  logger.log('Contracts patterns were successfuly fetched from contracts API');
  return contractsPatterns;
};

//Todo: Ideally, if this module is to be extracted to a lib, it should not
//depend on external modules (it currently uses configService and axiosService)
@Module({})
export class ContractsConnectorModule {
  static forRootAsync({ isGlobal = true, contracts }: IContractsConnectorModuleOptions): DynamicModule {
    return {
      module: ContractsConnectorModule,
      global: isGlobal,
      imports: [AxiosModule], //no need to import ConfigService as it is declared global in app module
      providers: [
        {
          provide: 'CONTRACT_PATTERNS',
          inject: [AppConfigService, AxiosService],
          useFactory: async (config: AppConfigService, axiosService: AxiosService) =>
            await provideContracts(contracts, config, axiosService),
        },
      ],
      exports: ['CONTRACT_PATTERNS'],
    };
  }
}
