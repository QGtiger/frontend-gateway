import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AliOssModule } from '../alioss/alioss.module';
import { GatewayMiddleware } from './gateway.middleware';
import { GatewayService } from './gateway.service';

@Module({
  imports: [AliOssModule],
  providers: [GatewayService, GatewayMiddleware],
})
export class GatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GatewayMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
