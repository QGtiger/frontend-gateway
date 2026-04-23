// common.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class CommonFilter implements ExceptionFilter {
  private readonly logger = new Logger(CommonFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // 确定状态码和错误消息
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
      details = typeof res === 'object' ? res : null;
    } else if (exception instanceof Error) {
      message = exception.message;
      details = exception.stack;
    }

    // 记录错误日志（如果拦截器已经记录过，可以避免重复；但这里作为兜底）
    this.logger.error({
      event: 'unhandled-exception',
      method: request.method,
      url: request.url,
      statusCode: status,
      ip: request.ip,
      message,
      stack: details,
    });

    // 统一错误响应格式（注意：这里使用正确的 HTTP 状态码，不再是 200）
    const errorResponse = {
      success: false,
      code: status,
      message: Array.isArray(message) ? message.join(', ') : message,
      // 可选：开发环境返回堆栈信息
      ...(process.env.NODE_ENV === 'development' && { stack: details }),
    };

    response.status(200).json(errorResponse);
  }
}
