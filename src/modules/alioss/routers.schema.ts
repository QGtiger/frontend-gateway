import { BadRequestException } from '@nestjs/common';
import { ZodError, z } from 'zod';
import { DEFAULT_ROUTERS_DOC_VERSION } from './routers.constants';

export const routerPublishRecordSchema = z.object({
  /** 发布版本号（数字；coerce 兼容 JSON 里曾存成字符串的旧数据） */
  version: z.coerce.number().finite(),
  ossIndexUrl: z.string().min(1),
  publishedAt: z.string().min(1),
  note: z.string().optional(),
});

export const routerAppEntrySchema = z.object({
  id: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: 'id 不能为空' }),
  domain: z.string().optional(),
  path: z.string().optional(),
  enable: z.boolean().default(true),
  /** 业务自定义配置，任意键值对象 */
  config: z.record(z.string(), z.unknown()).optional(),
  currentVersion: z.coerce.number().finite(),
  ossIndexUrl: z.string().min(1),
  publishList: z.array(routerPublishRecordSchema).default([]),
});

export const routersDocumentSchema = z
  .object({
    version: z.preprocess((v) => {
      if (v === undefined || v === null) {
        return DEFAULT_ROUTERS_DOC_VERSION;
      }
      if (typeof v === 'string') {
        const t = v.trim();
        return t.length > 0 ? t : DEFAULT_ROUTERS_DOC_VERSION;
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        return String(v);
      }
      return DEFAULT_ROUTERS_DOC_VERSION;
    }, z.string().min(1)),
    apps: z.array(routerAppEntrySchema),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < data.apps.length; i++) {
      const id = data.apps[i].id;
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `重复的 app id: ${id}`,
          path: ['apps', i, 'id'],
        });
      }
      seen.add(id);
    }
  });

export type RouterPublishRecord = z.infer<typeof routerPublishRecordSchema>;
export type RouterAppEntry = z.infer<typeof routerAppEntrySchema>;
export type RoutersDocument = z.infer<typeof routersDocumentSchema>;

/**
 * 校验 OSS 或内存中的 routers 文档；失败时抛出 BadRequestException（含 zod flatten）
 */
export function parseRoutersDocument(raw: unknown): RoutersDocument {
  try {
    return routersDocumentSchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new BadRequestException({
        message: 'routers.json 校验失败',
        errors: e.flatten(),
      });
    }
    throw e;
  }
}
