import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ApiKeyService } from '../../modules/api-key/api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') return false;

    const result = await this.apiKeyService.validateAndLog(
      apiKey,
      request.route?.path || request.url,
      request.method,
    );

    if (!result.valid) return false;

    request.user = { id: result.userId, role: 'api', jti: '' };
    return true;
  }
}
