import { providers } from 'ethers';
import { defaultAccounts } from './default-accounts';
import type { EthereumProviderOptions } from '@ganache/ethereum-options';
import type { Provider } from 'ganache';

export interface LocalProviderOptions {
  ganacheOptions: EthereumProviderOptions;
}

const defaultOpts: EthereumProviderOptions = {
  wallet: { accounts: defaultAccounts },
  logging: { quiet: true },
  chain: { chainId: 1337, hardfork: 'byzantium', networkId: 1337, vmErrorsOnRPCResponse: false },
  miner: { defaultGasPrice: 0 },
};

export function createLocalProvider(options?: LocalProviderOptions) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const provider: Provider = require('ganache').provider({ ...defaultOpts, ...options?.ganacheOptions });
  return new providers.Web3Provider(provider);
}
