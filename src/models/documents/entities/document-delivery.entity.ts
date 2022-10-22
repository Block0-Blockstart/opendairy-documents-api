import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { DocumentDeliveryStatus } from '../enums/DocumentDeliveryStatus.enum';
import { DocumentRequest } from './document-request.entity';

@Entity()
export class DocumentDelivery {
  @PrimaryColumn()
  id: string; //id = txHash

  @Column()
  sentDate: number;

  @ManyToOne(() => DocumentRequest, dr => dr.documentDeliveries)
  documentRequest: DocumentRequest;

  @Column()
  verificationHash: string; //doc hash, as stored in SC

  @Column({ nullable: true })
  rejectionReason: string; // as provided to sc

  @Column()
  url: string; //S3 url

  @Column({ type: 'simple-enum', enum: DocumentDeliveryStatus })
  status: DocumentDeliveryStatus; // same as sc

  /* NOTE: we no more need to store sender and receiver here as we have an
    association with a single DR, which have a single requestedBy and a
    single requestedTo.
    So requestedBy is always the receiver and
    requestedTo is always the sender.
  */
}
