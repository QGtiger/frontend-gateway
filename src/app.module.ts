import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AliOssModule } from './modules/alioss/alioss.module';
import { HealthModule } from './modules/health/health.module';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CommonFilter } from './common/common.filter';
import { CommonInterceptor } from './common/common.interceptor';
import { GatewayModule } from './modules/gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    AliOssModule,
    GatewayModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: CommonFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CommonInterceptor,
    },
  ],
})
export class AppModule {}
