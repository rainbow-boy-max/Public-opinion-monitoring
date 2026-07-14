import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { throwBusiness } from '../errors/business.exception';

function extractToken(request: any): string | null {
  const authHeader = request.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookies = parseCookies(request.headers?.cookie);
  if (cookies['admin_token']) return cookies['admin_token'];
  if (cookies['auth_token']) return cookies['auth_token'];
  const qs = request.query?.token || request.query?.access_token;
  if (typeof qs === 'string' && qs.length > 0) return qs;
  return null;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.split('=');
    if (!k) continue;
    out[k.trim()] = decodeURIComponent(rest.join('=').trim());
  }
  return out;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractToken(request);
    if (!token) {
      throwBusiness('AUTH_TOKEN_INVALID', { reason: 'missing_credentials' });
    }

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
