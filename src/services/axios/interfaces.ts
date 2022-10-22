import { AxiosRequestConfig } from 'axios';

export interface IAxiosResponse<T> {
  error: null | { message: string; code: number };
  data: T;
}

export interface IAxiosConfig extends AxiosRequestConfig {
  'axios-retry'?: {
    retries?: number;
    retryCondition?: (error: any) => boolean;
    retryDelay: (retryCount: number, error: any) => number;
    shouldResetTimeout?: boolean;
    onRetry: (retryCount: number, error: any, config: IAxiosConfig) => any;
  };
}
