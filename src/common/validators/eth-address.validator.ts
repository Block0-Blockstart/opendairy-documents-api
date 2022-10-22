import {
  IS_ETHEREUM_ADDRESS,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isAddress } from 'ethers/lib/utils';
import { IClass } from '../../interfaces/IClass';

@ValidatorConstraint({ async: false })
class IsEthereumAddressConstraint implements ValidatorConstraintInterface {
  validate(value: any, _validationArguments?: ValidationArguments): boolean {
    return isAddress(value);
  }
  defaultMessage?(_validationArguments?: ValidationArguments): string {
    return '$property must be an Ethereum address';
  }
}

export const IsEthereumAddress = (validationOptions?: ValidationOptions): PropertyDecorator => {
  return (obj: IClass, propertyName: string) => {
    registerDecorator({
      name: IS_ETHEREUM_ADDRESS,
      target: obj.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEthereumAddressConstraint,
    });
  };
};
