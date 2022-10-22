import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/app/app.config.service';
import { AxiosService } from '../../axios/axios.service';
import { CognitoUser } from './interfaces';

@Injectable()
export class AuthConnectorService {
  authUrl: string;
  cognitoUrl: string;

  constructor(private config: AppConfigService, private ax: AxiosService) {
    this.authUrl = this.config.API_AUTH_FULL_URL;
    this.cognitoUrl = this.config.AWS_COGNITO_URL;
  }

  async signup(email: string, password: string) {
    return await this.ax.sendRequest<any>({ url: this.authUrl + '/signup', method: 'POST', data: { email, password } });
  }

  async getUser(token: string) {
    return await this.ax.sendRequest<CognitoUser>({
      method: 'POST',
      url: this.cognitoUrl,
      //see https://newbedev.com/how-to-get-user-attributes-username-email-etc-using-cognito-identity-id
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.GetUser',
      },
      data: { AccessToken: token },
    });
  }
}
