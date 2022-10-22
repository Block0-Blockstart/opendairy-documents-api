import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { AdminSetup } from '../../services/admin-setup/admin-setup.module';

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

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger('AdminGuard');
  constructor(@Inject('ADMIN_SETUP') private adminSetup: AdminSetup) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const adminWallet = this.adminSetup.adminWallet;
    const can = req?.headers?.odadm === adminWallet.privateKey;
    this.logger.verbose(
      can
        ? `IP ${getIp(req)} has been granted admin access using the valid pk from wallet ${adminWallet.address}.`
        : `IP ${getIp(req)} has been refused admin access.`
    );
    return can;
  }
}
