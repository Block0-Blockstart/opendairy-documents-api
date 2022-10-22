import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentUserMiddleware } from './middlewares/current-user.middleware';
import { AuthConnectorModule } from '../../services/connectors/auth/auth.connector.module';
import { ContractsModule } from '../../services/contracts/contracts.module';
import { AdminSetupModule } from '../../services/admin-setup/admin-setup.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthConnectorModule, ContractsModule, AdminSetupModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule implements NestModule {
  /* IMPORTANT NOTE
   * We configure the middleware to be available in EVERY ROUTE ('*'),
   * and not only routes behind this module's controller ('/user')
   * We could have define this middleware at app.module level, to be clear on the global availability.
   * BUT, middlewares use dependency injection, and this one depends on services from AuthConnectorModule
   * and from UsersModule. So, if we declare it in app.module, we must import all these module at top level.
   * Because this middleware is clearly a feature coming with user module, we decide to declare it here instead.
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CurrentUserMiddleware).forRoutes('*');
  }
}
