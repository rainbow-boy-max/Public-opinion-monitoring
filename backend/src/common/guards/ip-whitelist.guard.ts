import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);
  private allowedIps: string[] = [];

  constructor(private configService: ConfigService) {
    const whitelist = this.configService.get<string>('ALLOWED_ADMIN_IPS') || process.env.ALLOWED_ADMIN_IPS || '';
    this.allowedIps = whitelist
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.allowedIps.length === 0) {
      return true; // No whitelist configured, allow all
    }

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers['x-forwarded-for']?.split(',')[0]?.trim();

    if (!ip) {
      this.logger.warn('Cannot determine client IP');
      return false;
    }

    const isAllowed = this.allowedIps.some((allowedIp) => {
      if (allowedIp.includes('*')) {
        const regex = new RegExp(allowedIp.replace(/\*/g, '\\d+'));
        return regex.test(ip);
      }
      return ip === allowedIp;
    });

    if (!isAllowed) {
      this.logger.warn(`IP ${ip} is not in whitelist`);
    }

    return isAllowed;
  }
}