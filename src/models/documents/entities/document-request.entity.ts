import { User } from '../../../models/users/entities/user.entity';
import { Column, Entity, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { DocumentDelivery } from './document-delivery.entity';
import { DocumentType } from '../enums/DocumentType.enum';

@Entity()
export class DocumentRequest {
  @PrimaryColumn()
  id: string; //id = deployed address

  @Column()
  requestDate: number;

  @Column({ nullable: true })
  deadline: number; // should be optional

  @Column({ type: 'simple-enum', enum: DocumentType })
  documentType: DocumentType; //see list provided by OD team

  @ManyToOne(() => User, user => user.documentsRequestedByUser)
  requestedBy: User;

  @ManyToOne(() => User, user => user.documentsRequestedToUser)
  requestedTo: User;

  @OneToMany(() => DocumentDelivery, dd => dd.documentRequest)
  documentDeliveries: DocumentDelivery[];

  //NOTE: if deals were managed by this databse, we should have a deal association here.
}
