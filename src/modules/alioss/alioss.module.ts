import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS = require('ali-oss');
import { ALI_OSS_CLIENT } from './alioss.constants';
import { RoutersController } from './routers.controller';
import { RoutersService } from './routers.service';

/** 全局注册 OSS client，其它模块可直接 @Inject(ALI_OSS_CLIENT) */
@Global()
@Module({
  controllers: [RoutersController],
  providers: [
    {
      provide: ALI_OSS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OSS({
          region: config.get<string>('ALIOSS_REGION'),
          accessKeyId: config.get<string>('ALIOSS_ACCESS_KEY_ID'),
          accessKeySecret: config.get<string>('ALIOSS_ACCESS_KEY_SECRET'),
          bucket: config.get<string>('ALIOSS_BUCKET'),
        }),
    },
    RoutersService,
  ],
  exports: [ALI_OSS_CLIENT, RoutersService],
})
export class AliOssModule {}
