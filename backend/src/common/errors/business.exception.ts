import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodeKey, ErrorCodeMeta } from './error-codes';

export class BusinessException extends HttpException {
  public readonly errorCode: ErrorCodeKey;
  public readonly errorMeta: ErrorCodeMeta;
  public readonly details?: Record<string, unknown>;

  constructor(errorCode: ErrorCodeKey, details?: Record<string, unknown>, messageOverride?: string) {
    const meta = ErrorCode[errorCode];
    const responseBody = {
      code: meta.httpStatus,
      errorCode: meta.code,
      message: messageOverride || meta.zh,
      messageEn: meta.en,
      hintZh: meta.hintZh,
      hintEn: meta.hintEn,
      actionZh: meta.actionZh,
      actionEn: meta.actionEn,
      actionTarget: (meta as any).actionTarget,
      details,
      timestamp: new Date().toISOString(),
    };
    super(responseBody, meta.httpStatus);
    this.errorCode = errorCode;
    this.errorMeta = meta;
    this.details = details;
  }
}

export function throwBusiness(
  errorCode: ErrorCodeKey,
  details?: Record<string, unknown>,
  messageOverride?: string,
): never {
  throw new BusinessException(errorCode, details, messageOverride);
}
