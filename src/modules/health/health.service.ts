import { Injectable } from '@nestjs/common';

export interface HealthPayload {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  getLiveness(): HealthPayload {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness：进程可对外提供服务。后续可在此检查发布存储、下游连通性等。
   */
  getReadiness(): HealthPayload {
    return this.getLiveness();
  }
}
