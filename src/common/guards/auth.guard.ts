import { CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';

const extractFromHeader = (req: Request, header: string): string => {
  const ip = req.header(header.toLowerCase());
  return Array.isArray(ip) ? ip[0] : ip;
};

const getIp = (req: Request): string => {
  return (
    extractFromHeader(req, 'x-forwarded-for') ||
    extractFromHeader(req, 'x-forwarded') ||
    extractFromHeader(req, 'forwarded-for') ||
    extractFromHeader(req, 'forwarded') ||
    req.socket.remoteAddress ||
    'unknown IP'
  );
};

export class AuthGuard implements CanActivate {
  private readonly logger = new Logger('AuthGuard');
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest();
    if (req.currentUser.error) {
      this.logger.log(`Auth rejected IP ${getIp(req)} - ${req.currentUser.error}`);
      //that's ugly, but guards does not allow custom message, so we throw to let the frontend know
      if (req.currentUser.error === 'Access Token has expired') {
        throw new ForbiddenException('Access Token has expired');
      }
    }
    return req.currentUser.user;
  }
}
