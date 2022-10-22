import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { ClientRequest } from 'http';
import { IAxiosConfig, IAxiosResponse } from './interfaces';

@Injectable()
export class AxiosService {
  private readonly logger = new Logger('AxiosService');
  private ax: AxiosInstance;

  constructor() {
    this.ax = axios.create();
    // default axios timeout is 0, which means no timeout.
    // But axios in nodeJs uses http module, which sets the timeout to 2 minutes.
    // we could add a timeout, but axios is buggy with that: see https://github.com/axios/axios/issues/647#issuecomment-459517694
    // And another risk is that expected response time may vary a lot
    // depending on the url to call. So this general purpose lib may not be the good place
    // to set a timeout delay.
    axiosRetry(this.ax, {
      retries: 4,
      retryDelay: retryCount => retryCount * 250,
      onRetry: (retryCount, error, config) =>
        this.logger.verbose(
          `Retrying [${retryCount}] request to ${config.url} after a ${
            (error.response && error.response.status) || error.code || '[no-status-code]'
          } status code response.`
        ),
    });
  }

  async sendRequest<T>(config: IAxiosConfig): Promise<IAxiosResponse<T>> {
    try {
      const { data } = await this.ax(config);
      return { error: null, data };
    } catch (e) {
      if (e.response) {
        if (e.response.status < 500) {
          return {
            error: { message: e.response.data.message || 'Unknown error', code: e.response.status },
            data: null,
          };
        } else {
          return { error: { message: 'API internal error', code: e.response.status }, data: null };
        }
      } else if (e.request as ClientRequest) {
        // note: the request was made but no response was received. `e.request` is an instance of http.ClientRequest
        // We LOG the connection error in this backend...
        this.logger.warn(`Request to ${config.url} has failed without response. See details below:`);
        console.log(e);
        // ...but for the end-client, it's an opaque 500 internal error.
        return { error: { message: 'API internal error', code: 500 }, data: null };
      } else {
        // Something happened in setting up the request that triggered an Error
        this.logger.error(`Request to ${config.url} has failed because of shitty code. Needs debug.`);
        return { error: { message: 'API internal error', code: 500 }, data: null };
      }
    }
  }
}
