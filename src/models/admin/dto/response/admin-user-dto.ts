import { Expose } from 'class-transformer';

//this dto is used when returning a User in a response
export class AdminUserDto {
  @Expose()
  id: string;

  @Expose()
  deleted?: string;

  @Expose()
  ethAddress?: string;

  @Expose()
  pubKey?: string;

  @Expose()
  emailHash?: string;
}
