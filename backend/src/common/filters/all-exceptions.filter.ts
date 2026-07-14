import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCodeKey } from '../errors/error-codes';

interface UnifiedErrorBody {
  code: number;
  errorCode: string;
  message: string;
  messageEn: string;
  hintZh: string;
  hintEn: string;
  actionZh: string;
  actionEn: string;
  actionTarget?: string;
  details?: Record<string, unknown>;
  path?: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildBody(exception, request);
    response.status(body.code).json(body);

    if (body.code >= 500) {
      const err = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`[${body.errorCode}] ${err}`);
    }
  }

  private buildBody(exception: unknown, request: Request): UnifiedErrorBody {
    const timestamp = new Date().toISOString();
    const path = request.url;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as any;
      if (res && typeof res === 'object' && 'errorCode' in res) {
        return {
          code: status,
          errorCode: res.errorCode,
          message: res.message || '',
          messageEn: res.messageEn || '',
          hintZh: res.hintZh || '',
          hintEn: res.hintEn || '',
          actionZh: res.actionZh || '',
          actionEn: res.actionEn || '',
          actionTarget: res.actionTarget,
          details: res.details,
          path,
          timestamp,
        };
      }
      const fallbackZh = typeof res === 'string' ? res : res?.message || '请求失败';
      const fallbackEn = typeof res === 'object' && res?.message ? res.message : fallbackZh;
      return {
        code: status,
        errorCode: status === 401 ? 'AUTH_TOKEN_INVALID' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 429 ? 'RATE_LIMITED' : 'BAD_REQUEST',
        message: fallbackZh,
        messageEn: fallbackEn,
        hintZh: '',
        hintEn: '',
        actionZh: '刷新页面',
        actionEn: 'Refresh',
        path,
        timestamp,
      };
    }

    const errMsg = exception instanceof Error ? exception.message : String(exception);
    return {
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_ERROR',
      message: errMsg || '服务器内部错误',
      messageEn: errMsg || 'Internal server error',
      hintZh: '系统出现异常，请稍后重试或联系技术支持。',
      hintEn: 'Server error. Please retry or contact support.',
      actionZh: '刷新页面',
      actionEn: 'Refresh page',
      path,
      timestamp,
    };
  }
}
