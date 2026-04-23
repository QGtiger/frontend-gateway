import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class CommonInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CommonInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl, ip, body, query, params } = request;
    const startTime = Date.now();

    // 可选：脱敏请求体中的敏感字段
    const sanitizedBody = this.sanitize(body);

    // 请求开始日志（开发环境可开启，生产环境建议关闭以减少日志量）
    // this.logger.debug(`Request: ${method} ${originalUrl} - Body: ${JSON.stringify(sanitizedBody)}`);

    return next.handle().pipe(
      // 成功响应：包装数据并记录日志
      map((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log({
          event: 'http-response',
          method,
          url: originalUrl,
          statusCode,
          duration,
          ip,
          success: true,
        });

        return {
          success: true,
          data,
          code: 200,
        };
      }),
      // 捕获异常：记录错误日志并统一返回错误格式
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || error.getStatus?.() || 500;
        const message = error.message || 'Internal server error';

        this.logger.error({
          event: 'http-error',
          method,
          url: originalUrl,
          statusCode,
          duration,
          ip,
          success: false,
          error: error.stack,
          requestBody: sanitizedBody,
        });

        // 重新抛出，让全局异常过滤器处理（或者直接返回统一错误格式）
        // 如果希望拦截器统一处理错误响应，可以返回以下格式，但注意不要重复处理
        return throwError(() => error);
      }),
    );
  }

  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const clone = { ...obj };
    const sensitiveFields = [
      // 'password',
      // 'token',
      // 'secret',
      // 'authorization',
      // 'refreshToken',
    ];
    for (const field of sensitiveFields) {
      if (clone[field]) clone[field] = '***';
    }
    return clone;
  }
}
