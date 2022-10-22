import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuthConnectorService } from '../../../services/connectors/auth/auth.connector.service';
import { UsersService } from '../users.service';

@Injectable()
export class CurrentUserMiddleware implements NestMiddleware {
  private readonly logger = new Logger('CurrentUserMiddleware');
  constructor(private userService: UsersService, private authConnectorService: AuthConnectorService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        req.currentUser = { error: 'No authorization header in request', user: null };
        return next();
      }

      const token = authHeader.split(' ')[1]; // remove the leading 'Bearer '
      if (!token) {
        req.currentUser = { error: 'No Bearer token in authorization header', user: null };
        return next();
      }

      const { error, data } = await this.authConnectorService.getUser(token);

      if (error) {
        req.currentUser = { error: error.message, user: null };
        return next();
      } else {
        const userAttributes = data.UserAttributes;

        let email: string;
        userAttributes.forEach(ua => {
          if (ua.Name === 'email') {
            email = ua.Value;
            return;
          }
        });

        try {
          //findOne second param is true, to ignore users marked as deleted
          const currentUser = await this.userService.findOne(email, true);
          req.currentUser = { error: null, user: currentUser };
          return next();
        } catch (e) {
          //at this point, an error means the user exists on cognito side but
          //this user is marked as 'deleted' in database, so he is considered not existing
          this.logger.verbose(`User with email ${email} exists in Cognito but not in DB (or it's tagged 'deleted')`);
          req.currentUser = { error: 'User does not exist', user: null };
          return next();
        }
      }
    } catch (e) {
      this.logger.error('Internal error while retrieving current user: ');
      this.logger.error(e);
      this.logger.error('Above error needs debug. It will be ignored this time!');
      req.currentUser = { error: 'Internal error', user: null };
      return next();
    }
  }
}
