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

/** POST /routers/document/replace 整份替换 */
export class RoutersDocumentDto {
  @IsString()
  @IsNotEmpty()
  version: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouterAppEntryDto)
  apps: RouterAppEntryDto[];
}

/** POST /routers/app/get — body: { id } */
export class GetAppDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

/**
 * POST /routers/app/deploy — 无此 id 则新建，有则按发布追加版本（id 在 body）
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

/** 局部更新字段（不含 id） */
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

/** POST /routers/app/update — id 与可改字段均在 body */
export class UpdateAppDto extends PatchAppDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

/** POST /routers/app/remove */
export class RemoveAppDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

/** POST /routers/app/rollback */
export class RollbackDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @Type(() => Number)
  @IsNumber()
  version: number;
}

/** 单次发布载荷（deploy 等流程内部使用） */
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

