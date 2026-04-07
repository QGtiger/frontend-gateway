import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

@Catch()
export class CommonFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const res =
      exception instanceof HttpException
        ? (exception.getResponse() as any)
        : exception;

    // 优先使用 status，如果不存在再使用 code（兼容旧代码）
    const code =
      exception.getStatus?.() ||
      (exception as any).status ||
      (exception as any).code ||
      500;

    const errorResponse = {
      success: false,
      message: res.message?.join
        ? res.message.join(', ')
        : res.message || exception.message,
      code,
    };

    response.status(200).json(errorResponse);
  }
}
