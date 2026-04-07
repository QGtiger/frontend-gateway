import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { RoutersDocument } from './routers.types';
import {
  DeployAppDto,
  PatchAppDto,
  RollbackDto,
  RoutersDocumentDto,
} from './routers.dto';
import { RoutersService } from './routers.service';

@Controller('routers')
export class RoutersController {
  constructor(private readonly routersService: RoutersService) {}

  @Get()
  getDocument(): Promise<RoutersDocument> {
    return this.routersService.getDocument();
  }

  @Put()
  replaceDocument(@Body() body: RoutersDocumentDto): Promise<RoutersDocument> {
    return this.routersService.replaceDocument(body);
  }

  @Get('apps/:id')
  getApp(@Param('id') id: string) {
    return this.routersService.getApp(id);
  }

  /** 无此 id 则新建 app，有则发布新版本 */
  @Post('apps')
  deployApp(@Body() body: DeployAppDto) {
    return this.routersService.deployApp(body);
  }

  @Patch('apps/:id')
  patchApp(@Param('id') id: string, @Body() body: PatchAppDto) {
    return this.routersService.patchApp(id, body);
  }

  @Delete('apps/:id')
  async deleteApp(@Param('id') id: string) {
    await this.routersService.deleteApp(id);
    return { ok: true };
  }

  @Post('apps/:id/rollback')
  rollback(@Param('id') id: string, @Body() body: RollbackDto) {
    return this.routersService.rollback(id, body);
  }
}
