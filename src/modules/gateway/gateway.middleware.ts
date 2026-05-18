import {
  Injectable,
  Logger,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { GatewayService } from './gateway.service';

@Injectable()
export class GatewayMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GatewayMiddleware.name);

  constructor(private readonly gatewayService: GatewayService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'GET') {
      return next();
    }
    const path = req.path || '/';
    if (path.startsWith('/health') || path.startsWith('/routers')) {
      return next();
    }

    const host = req.headers.host;
    const pathname = req.originalUrl?.split('?')[0] || req.url || '/';

    try {
      const app = await this.gatewayService.resolveApp(host, pathname);
      if (!app) {
        throw new NotFoundException('App not found');
      }
      const html = await this.gatewayService.buildHtmlResponse(app);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // 从 app.headers 中读取自定义响应头（如 COEP/COOP 等）
      const customHeaders = app.headers;
      if (customHeaders) {
        for (const [key, value] of Object.entries(customHeaders)) {
          if (value) {
            res.setHeader(key, value);
          }
        }
      }
      res.send(html);
    } catch (e) {
      this.logger.error('Gateway HTML 失败', e);
      throw e;
    }
  }
}
