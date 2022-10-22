import { UseInterceptors } from '@nestjs/common';
import { IClass } from '../../interfaces/IClass';
import { SerializeInterceptor } from '../interceptors/serialize.interceptor';

// sugar code decorator to use instead of declaring this long code when we use the interceptor:
// @UseInterceptors(new SerializeInterceptor(UserDto))
export const Serialize = (dto: IClass) => {
  return UseInterceptors(new SerializeInterceptor(dto));
};
