import { Module } from '@nestjs/common';
import { ethers } from 'ethers';
import { AppConfigService } from '../../config/app/app.config.service';

@Module({
  imports: [], // AppConfigModule is global, so no import
  providers: [
    {
      provide: 'CHAIN_PROVIDER',
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        return new ethers.providers.JsonRpcProvider(config.BLOCKCHAIN_RPC_URL_PORT);
      },
    },
  ],
  exports: ['CHAIN_PROVIDER'],
})
export class ChainProviderModule {}
