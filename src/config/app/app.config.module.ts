import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app.config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
      // envFilePath: `env.${process.env.NODE_ENV}`,
      envFilePath: `.env`,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
