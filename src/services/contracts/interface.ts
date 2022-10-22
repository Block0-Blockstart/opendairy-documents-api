import { BytesLike, errors, ethers } from 'ethers';

export interface IDefaultTxParams {
  chainId: number;
  gasPrice: ethers.BigNumber;
  gasLimit: ethers.BigNumber;
  type: number;
}

export interface ICreateUnsignedTxArgs {
  contractName: string;
  from: string;
  fn: string;
  fnParams?: any[];
  to: string;
}

export interface ICreateUnsignedContractArgs {
  contractName: string;
  from: string;
  ctorParams?: any[];
}

export interface IUnsignedTx {
  data: BytesLike;
  from: string;
  to?: string;
  nonce: number;
  gasLimit: ethers.BigNumber;
  gasPrice: ethers.BigNumber;
  chainId: number;
  type: number;
  [index: string]: any;
}

export interface IEthersError {
  code: errors;
  reason: string;
  [index: string]: any;
}

export interface IContractDeployed {
  from: string;
  transactionHash: string;
  contractAddress: string;
}

export interface ICheckSignedTx {
  signedTx: string;
  nonce?: number;
  from?: string;
  to?: string;
  fn?: {
    contractName: string;
    fnName: string;
    fnArgNames?: string[];
    fnArgValues?: any[];
  };
  throwOnFirstError?: boolean;
}

export interface IReadContractStorage {
  contractName: string;
  address: string;
  fnName: string;
  fnParams?: any[];
}

export interface ICheckSignedDeployTx {
  signedTx: string;
  nonce?: number;
  from?: string;
  throwOnFirstError?: boolean;
}
