import { Module } from '@nestjs/common';
import { ChainProviderModule } from '../chain-provider/chain-provider.module';
import { ContractsService } from './contracts.service';

@Module({
  imports: [ChainProviderModule],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
