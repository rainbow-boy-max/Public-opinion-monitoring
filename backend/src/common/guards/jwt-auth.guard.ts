import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { throwBusiness } from '../errors/business.exception';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throwBusiness('AUTH_TOKEN_INVALID', { reason: 'missing_authorization_header' });
    }

    const token = authHeader.substring(7);
    let payload: { sub: number; role: string; jti: string };
    try {
      payload = this.jwtService.verify(token);
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throwBusiness('AUTH_TOKEN_EXPIRED', { expiredAt: err.expiredAt?.toISOString?.() });
      }
      throwBusiness('AUTH_TOKEN_INVALID', { reason: 'signature_invalid' });
    }

    const blacklisted = await this.redisService.exists(`blacklist:jti:${payload.jti}`);
    if (blacklisted) {
      throwBusiness('AUTH_TOKEN_REVOKED', { jti: payload.jti.substring(0, 8) });
    }

    request.user = {
      id: payload.sub,
      role: payload.role,
      jti: payload.jti,
    };
    return true;
  }
}
