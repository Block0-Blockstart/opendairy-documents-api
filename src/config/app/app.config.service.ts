import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigNumber, ethers } from 'ethers';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum AdminSetupStrategy {
  FROM_FILE = 'FROM_FILE',
  FROM_DB = 'FROM_DB',
  FROM_ENV = 'FROM_ENV',
}

@Injectable()
export class AppConfigService {
  constructor(private cs: ConfigService) {}

  //reminder: environment is set in package.json, not in .env
  get NODE_ENV(): Environment {
    const v = this.cs.get('NODE_ENV');
    return v === Environment.Production
      ? Environment.Production
      : v === Environment.Test
      ? Environment.Test
      : Environment.Development;
  }

  get WITH_SWAGGER(): boolean {
    return !!this.cs.get<string>('WITH_SWAGGER');
  }

  get PORT(): number {
    return this.toNumberRequired('PORT');
  }

  get API_CONTRACTS_FULL_URL(): string {
    return this.toStringRequired('API_CONTRACTS_FULL_URL');
  }

  get API_AUTH_FULL_URL(): string {
    return this.toStringRequired('API_AUTH_FULL_URL');
  }

  get AWS_COGNITO_URL(): string {
    return this.toStringRequired('AWS_COGNITO_URL');
  }

  get AWS_S3_REGION(): string {
    return this.toStringRequired('AWS_S3_REGION');
  }

  get AWS_S3_BUCKET_NAME(): string {
    return this.toStringRequired('AWS_S3_BUCKET_NAME');
  }

  get AWS_S3_ACCESS_KEY_ID(): string {
    return this.NODE_ENV === Environment.Production
      ? this.cs.get('AWS_S3_ACCESS_KEY_ID')
      : this.toStringRequired('AWS_S3_ACCESS_KEY_ID');
  }

  get AWS_S3_SECRET_ACCESS_KEY(): string {
    return this.NODE_ENV === Environment.Production
      ? this.cs.get('AWS_S3_SECRET_ACCESS_KEY')
      : this.toStringRequired('AWS_S3_SECRET_ACCESS_KEY');
  }

  get BLOCKCHAIN_RPC_URL_PORT(): string {
    return this.toStringRequired('BLOCKCHAIN_RPC_URL_PORT');
  }

  get BLOCKCHAIN_CHAIN_ID(): number {
    return this.toNumberRequired('BLOCKCHAIN_CHAIN_ID');
  }

  get BLOCKCHAIN_TX_GAS_PRICE(): BigNumber {
    return this.toBigNumberRequired('BLOCKCHAIN_TX_GAS_PRICE');
  }

  get BLOCKCHAIN_TX_GAS_LIMIT(): BigNumber {
    return this.toBigNumberRequired('BLOCKCHAIN_TX_GAS_LIMIT');
  }

  get BLOCKCHAIN_TX_TYPE(): number {
    return this.toNumberRequired('BLOCKCHAIN_TX_TYPE');
  }

  get ADMIN_SETUP_STRATEGY(): AdminSetupStrategy {
    const v = this.cs.get('ADMIN_WALLET_STRATEGY');
    switch (v) {
      case AdminSetupStrategy.FROM_ENV:
        return AdminSetupStrategy.FROM_ENV;
      case AdminSetupStrategy.FROM_FILE:
        return AdminSetupStrategy.FROM_FILE;
      case AdminSetupStrategy.FROM_DB:
        return AdminSetupStrategy.FROM_DB;
      default:
        throw new Error(`Missing or bad environment variable: ADMIN_SETUP_STRATEGY`);
    }
  }

  get ADMIN_WALLET_PRIVATE_KEY(): string {
    if (this.ADMIN_SETUP_STRATEGY === AdminSetupStrategy.FROM_ENV)
      return this.toStringRequired('ADMIN_WALLET_PRIVATE_KEY');
    else return this.cs.get('ADMIN_WALLET_PRIVATE_KEY');
  }

  get ADMIN_CONTRACT_ACCOUNTS(): string {
    if (this.ADMIN_SETUP_STRATEGY === AdminSetupStrategy.FROM_ENV)
      return this.toStringRequired('ADMIN_CONTRACT_ACCOUNTS');
    else return this.cs.get('ADMIN_CONTRACT_ACCOUNTS');
  }

  private toNumberRequired(key: string): number {
    try {
      return Number.parseInt(this.cs.get<string>(key) || 'IWILLTHROW');
    } catch (e) {
      throw new Error(`Missing or bad environment variable: ${key}`);
    }
  }

  private toStringRequired(key: string): string {
    const v = this.cs.get(key);
    if (v) return v;
    throw new Error(`Missing or bad environment variable: ${key}`);
  }

  private toBigNumberRequired(key: string): BigNumber {
    const v = this.cs.get<string>(key);
    if (v === undefined || v === null) {
      throw new Error(`Missing or bad environment variable: ${key}`);
    }
    return ethers.BigNumber.from(v);
  }
}
