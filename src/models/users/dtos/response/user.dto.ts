import { Expose } from 'class-transformer';

//this dto is used when returning a User in a response
export class UserDto {
  @Expose()
  id: string;

  @Expose()
  ethAddress?: string;

  @Expose()
  pubKey?: string;

  @Expose()
  emailHash?: string;

  @Expose()
  lastNonceUsed?: number;
}
