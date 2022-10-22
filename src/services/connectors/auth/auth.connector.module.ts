import { Module } from '@nestjs/common';
import { AxiosModule } from '../../axios/axios.module';
import { AuthConnectorService } from './auth.connector.service';

@Module({
  imports: [AxiosModule],
  providers: [AuthConnectorService],
  exports: [AuthConnectorService],
})
export class AuthConnectorModule {}
