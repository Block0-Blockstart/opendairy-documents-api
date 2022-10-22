import { DocumentRequest } from '../../documents/entities/document-request.entity';
import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  ethAddress?: string;

  @Column({ nullable: true })
  pubKey?: string;

  @Column({ nullable: true })
  emailHash?: string;

  //TODO: on create tx, when nonce is fetched from node, record this here
  //when another create tx is called, if nonce from node === lastNonceUsed, it means there is a tx not sent and it should throw
  @Column({ nullable: true })
  lastNonceUsed?: number;

  @Column()
  deleted: boolean;

  @OneToMany(() => DocumentRequest, documentRequest => documentRequest.requestedBy)
  documentsRequestedByUser: DocumentRequest[];

  @OneToMany(() => DocumentRequest, documentRequest => documentRequest.requestedTo)
  documentsRequestedToUser: DocumentRequest[];
}
