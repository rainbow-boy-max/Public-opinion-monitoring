import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log_metadata';

export interface AuditLogOptions {
  module: string;
  action: string;
  resourceType?: string;
  resourceIdParam?: string;
  titleExpr?: string;
}

export const AuditLog = (options: AuditLogOptions): MethodDecorator =>
  SetMetadata(AUDIT_LOG_KEY, options);
