import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from '../../modules/collector/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;

    return next.handle().pipe(
      tap(() => {
        this.metrics.incrementRequest();
        const duration = Date.now() - start;
        if (duration > 1000) {
          this.logger.warn(`SLOW: ${method} ${url} took ${duration}ms`);
        }
      }),
      catchError((err) => {
        this.metrics.incrementError();
        const duration = Date.now() - start;
        this.logger.warn(`ERROR: ${method} ${url} (${duration}ms): ${err.message}`);
        throw err;
      }),
    );
  }
}