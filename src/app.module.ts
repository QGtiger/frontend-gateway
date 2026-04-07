import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AliOssModule } from './modules/alioss/alioss.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    AliOssModule,
  ],
})
export class AppModule {}
