import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { ContractsModule } from '../../services/contracts/contracts.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentDelivery } from './entities/document-delivery.entity';
import { DocumentRequest } from './entities/document-request.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentDelivery, DocumentRequest]), ContractsModule, UsersModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
