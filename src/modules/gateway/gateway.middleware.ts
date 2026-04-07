import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
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
        return next();
      }
      const html = await this.gatewayService.buildHtmlResponse(app);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e) {
      this.logger.error('Gateway HTML 失败', e);
      return next(e);
    }
  }
}
