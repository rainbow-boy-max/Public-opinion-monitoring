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

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMeta = this.reflector.getAllAndOverride<AuditLogOptions>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!auditMeta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap(() => {
        const actorId = user?.id ?? null;
        const actorType = 'admin';

        let resourceId: number | null = null;
        if (auditMeta.resourceIdParam) {
          const val = request.params[auditMeta.resourceIdParam];
          resourceId = val ? Number(val) : null;
        }

        let title = auditMeta.titleExpr || `${auditMeta.module}/${auditMeta.action}`;
        if (request.body && auditMeta.titleExpr?.includes('{')) {
          title = auditMeta.titleExpr.replace(/\{(\w+)\}/g, (_: string, key: string) => {
            return request.body?.[key] || request.params?.[key] || key;
          });
        }

        const xff = request.headers?.['x-forwarded-for'];
        const ipAddress =
          typeof xff === 'string'
            ? xff.split(',')[0].trim()
            : request.ip || request.socket?.remoteAddress || null;

        this.auditService.log({
          actorId,
          actorType,
          module: auditMeta.module,
          action: auditMeta.action,
          resourceType: auditMeta.resourceType || null,
          resourceId,
          title,
          content: request.method === 'DELETE' ? undefined : JSON.stringify(request.body || {}),
          ipAddress,
        });
      }),
    );
  }
}
