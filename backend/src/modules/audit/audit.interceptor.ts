import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDIT_LOG_KEY, AuditLogOptions } from './audit-log.decorator';

const SENSITIVE_KEYS = ['password', 'passwd', 'pwd', 'secret', 'accesskeysecret', 'access_key_secret', 'apikey', 'api_key', 'token', 'authorization', 'oldpassword', 'newpassword'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const user = request.user;

    // 是否已声明 @AuditLog 装饰器
    const auditMeta = this.reflector.getAllAndOverride<AuditLogOptions>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 只记录写操作（POST/PUT/PATCH/DELETE），GET 不记录（避免日志爆炸）
    const isWriteOp = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!auditMeta && !isWriteOp) {
      return next.handle();
    }

    // 跳过认证和健康检查等高频接口
    const path = request.path || request.url || '';
    const skipPaths = [
      '/api/auth/login', '/api/auth/refresh-token', '/api/auth/logout',
      '/api/ops/healthz', '/api/ops/metrics', '/api/ops/prometheus',
      '/api/auth/send-sms-code', '/api/captcha/verify',
    ];
    if (skipPaths.some((p) => path.includes(p))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const actorId = user?.id ?? null;
        // P1-9: 修复 actorType 硬编码，从 user.role 动态获取
        const actorType = user?.role || 'system';

        let resourceId: number | null = null;
        if (auditMeta?.resourceIdParam) {
          const val = request.params[auditMeta.resourceIdParam];
          resourceId = val ? Number(val) : null;
        }

        let module = auditMeta?.module || this.resolveModule(path);
        let action = auditMeta?.action || method.toLowerCase();

        let title = auditMeta?.titleExpr || `${module}/${action}`;
        if (request.body && auditMeta?.titleExpr?.includes('{')) {
          title = auditMeta.titleExpr.replace(/\{(\w+)\}/g, (_: string, key: string) => {
            return request.body?.[key] || request.params?.[key] || key;
          });
        }

        const xff = request.headers?.['x-forwarded-for'];
        const ipAddress =
          typeof xff === 'string'
            ? xff.split(',')[0].trim()
            : request.ip || request.socket?.remoteAddress || null;

        const content = method === 'DELETE'
          ? JSON.stringify({ id: request.params })
          : JSON.stringify(this.sanitizeBody(request.body || {}));

        this.auditService.log({
          actorId,
          actorType,
          module,
          action,
          resourceType: auditMeta?.resourceType || null,
          resourceId,
          title,
          content,
          ipAddress,
        });
      }),
    );
  }

  private resolveModule(path: string): string {
    const segments = path.replace('/api/', '').split('/');
    return segments[0] || 'unknown';
  }

  private sanitizeBody(body: Record<string, any>): Record<string, any> {
    if (!body || typeof body !== 'object') return body;
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
        clean[key] = '***';
      } else if (value && typeof value === 'object') {
        clean[key] = this.sanitizeBody(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }
}
