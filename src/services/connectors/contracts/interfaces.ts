export interface IContractsConnectorModuleOptions {
  isGlobal?: boolean;
  contracts: Array<string>;
}

export interface IContractPattern {
  name: string;
  abi: Array<any>;
  bytecode: {
    object: string;
    [propName: string]: any;
  };
}
