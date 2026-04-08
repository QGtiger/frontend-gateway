import { Body, Controller, Get, Post } from '@nestjs/common';
import type { RoutersDocument } from './routers.types';
import {
  DeployAppDto,
  GetAppDto,
  RemoveAppDto,
  RollbackDto,
  RoutersDocumentDto,
  UpdateAppDto,
} from './routers.dto';
import { RoutersService } from './routers.service';

@Controller('routers')
export class RoutersController {
  constructor(private readonly routersService: RoutersService) {}

  /** 读取 OSS 中的整份 routers 配置 */
  @Get('document/read')
  getDocument(): Promise<RoutersDocument> {
    return this.routersService.getDocument();
  }

  /** 用请求体整份覆盖 OSS 中的 routers 配置（仅 POST） */
  @Post('document/replace')
  replaceDocument(@Body() body: RoutersDocumentDto): Promise<RoutersDocument> {
    return this.routersService.replaceDocument(body);
  }

  /** 按 id 查询单个 app（参数均在 body，无路径变量） */
  @Post('app/get')
  getApp(@Body() body: GetAppDto) {
    return this.routersService.getApp(body.id);
  }

  /**
   * 发布：无此 id 则新建 app，有则追加新版本
   */
  @Post('app/deploy')
  deployApp(@Body() body: DeployAppDto) {
    return this.routersService.deployApp(body);
  }

  /** 局部更新 app（id 与可改字段均在 body） */
  @Post('app/update')
  patchApp(@Body() body: UpdateAppDto) {
    const { id, ...patch } = body;
    return this.routersService.patchApp(id, patch);
  }

  /** 删除 app */
  @Post('app/remove')
  async deleteApp(@Body() body: RemoveAppDto) {
    await this.routersService.deleteApp(body.id);
    return { ok: true };
  }

  /** 回滚到指定历史版本（id、version 均在 body） */
  @Post('app/rollback')
  rollback(@Body() body: RollbackDto) {
    return this.routersService.rollback(body);
  }
}
