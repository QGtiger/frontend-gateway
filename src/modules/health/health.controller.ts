import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthPayload } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 聚合健康信息，供监控或人工排查。
   */
  @Get()
  getHealth(): HealthPayload & { live: HealthPayload; ready: HealthPayload } {
    const live = this.healthService.getLiveness();
    const ready = this.healthService.getReadiness();
    return {
      status: live.status === 'ok' && ready.status === 'ok' ? 'ok' : 'error',
      uptime: live.uptime,
      timestamp: live.timestamp,
      live,
      ready,
    };
  }

  /** Kubernetes / 负载均衡存活探针 */
  @Get('live')
  getLive(): HealthPayload {
    return this.healthService.getLiveness();
  }

  /** Kubernetes 就绪探针 */
  @Get('ready')
  getReady(): HealthPayload {
    return this.healthService.getReadiness();
  }
}
