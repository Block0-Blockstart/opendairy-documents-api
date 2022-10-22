import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsModule } from '../../services/contracts/contracts.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AdminSetupModule } from '../../services/admin-setup/admin-setup.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ContractsModule, UsersModule, AdminSetupModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
