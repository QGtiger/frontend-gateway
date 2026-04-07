import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class RouterPublishRecordDto {
  @Type(() => Number)
  @IsNumber()
  version: number;

  @IsString()
  @IsNotEmpty()
  ossIndexUrl: string;

  @IsString()
  @IsNotEmpty()
  publishedAt: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RouterAppEntryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsBoolean()
  enable: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @Type(() => Number)
  @IsNumber()
  currentVersion: number;

  @IsString()
  @IsNotEmpty()
  ossIndexUrl: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouterPublishRecordDto)
  publishList: RouterPublishRecordDto[];
}

/** PUT /routers 整份替换 */
export class RoutersDocumentDto {
  @IsString()
  @IsNotEmpty()
  version: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouterAppEntryDto)
  apps: RouterAppEntryDto[];
}

/**
 * POST /routers/apps — 无此 id 则新建，有则按发布追加版本
 */
export class DeployAppDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @Type(() => Number)
  @IsNumber()
  version: number;

  @IsString()
  @IsNotEmpty()
  ossIndexUrl: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** 仅新建 app 时生效 */
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsBoolean()
  enable?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

/** 内部仍用于 createApp */
export class CreateAppDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsBoolean()
  enable?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @Type(() => Number)
  @IsNumber()
  currentVersion: number;

  @IsString()
  @IsNotEmpty()
  ossIndexUrl: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouterPublishRecordDto)
  publishList?: RouterPublishRecordDto[];
}

/** PATCH /routers/apps/:id */
export class PatchAppDto {
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsBoolean()
  enable?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

/** POST /routers/apps/:id/publish */
export class PublishDto {
  @Type(() => Number)
  @IsNumber()
  version: number;

  @IsString()
  @IsNotEmpty()
  ossIndexUrl: string;

  @IsOptional()
  @IsString()
  note?: string;
}

/** POST /routers/apps/:id/rollback */
export class RollbackDto {
  @Type(() => Number)
  @IsNumber()
  version: number;
}
