import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS = require('ali-oss');
import { ALI_OSS_CLIENT } from './alioss.constants';
import {
  DEFAULT_ROUTERS_DOC_VERSION,
  DEFAULT_ROUTERS_OBJECT_KEY,
} from './routers.constants';
import type {
  CreateAppDto,
  DeployAppDto,
  PatchAppDto,
  PublishDto,
  RollbackDto,
  RoutersDocumentDto,
} from './routers.dto';
import { parseRoutersDocument } from './routers.schema';
import type { RouterAppEntry, RoutersDocument } from './routers.types';

/** ali-oss 对「对象不存在」可能给 HTTP 404 或 NoSuchKey，两种都按未命中处理 */
function isOssNotFound(err: unknown): boolean {
  const e = err as { status?: number; code?: string };
  return e?.status === 404 || e?.code === 'NoSuchKey';
}

/**
 * OSS 对象内容若像 Express/Nest 的 404 JSON，说明请求未拿到真实对象（代理指错、桶/Key 不对或对象被误写成错误页）。
 */
function looksLikeHttpErrorJsonBody(v: unknown): v is { message?: string } {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const o = v as Record<string, unknown>;
  return (
    o.success === false &&
    typeof o.message === 'string' &&
    /cannot get\b/i.test(o.message)
  );
}

@Injectable()
export class RoutersService {
  private readonly logger = new Logger(RoutersService.name);
  private readonly objectKey: string;
  /** 0 表示不按时间过期，仅 persist 后刷新 */
  private readonly cacheTtlMs: number;
  /**
   * 读入或写入后的文档快照；下游会就地改 doc 再 save，故与内存中为同一引用。
   */
  private documentCache: { doc: RoutersDocument; expiresAt: number } | null =
    null;

  constructor(
    @Inject(ALI_OSS_CLIENT)
    private readonly oss: OSS,
    private readonly config: ConfigService,
  ) {
    this.objectKey =
      this.config.get<string>('ALIOSS_ROUTERS_OBJECT_KEY') ??
      DEFAULT_ROUTERS_OBJECT_KEY;
    // ROUTERS_DOCUMENT_CACHE_TTL_MS：毫秒，默认 30s；0=不按时间过期（仅写 OSS 后刷新）
    const defaultTtlMs = 30_000;
    this.cacheTtlMs = Math.max(
      Number(
        this.config.get<string>('ROUTERS_DOCUMENT_CACHE_TTL_MS') ||
          defaultTtlMs,
      ),
      0,
    );
  }

  private isCacheValid(): boolean {
    if (!this.documentCache) {
      return false;
    }
    // TTL=0：仅依赖「写 OSS」后 setCachedDoc，不按时间失效
    if (this.cacheTtlMs === 0) {
      return true;
    }
    return Date.now() < this.documentCache.expiresAt;
  }

  private setCachedDoc(doc: RoutersDocument): void {
    // TTL=0 时用极大时间戳，避免每次 isCacheValid 去算「永不过期」分支
    const expiresAt =
      this.cacheTtlMs === 0
        ? Number.MAX_SAFE_INTEGER
        : Date.now() + this.cacheTtlMs;
    this.documentCache = { doc, expiresAt };
  }

  async getDocument(): Promise<RoutersDocument> {
    if (this.isCacheValid() && this.documentCache) {
      return this.documentCache.doc;
    }
    // 未命中或已过期：重新拉 OSS（或 404 空文档），再写入缓存
    try {
      const ossInst = this.oss as unknown as {
        options?: Record<string, unknown>;
      };
      const opts = ossInst.options;
      const fmt = (v: unknown): string =>
        typeof v === 'string' ? v : v == null ? '(未配置)' : JSON.stringify(v);
      const bucketStr = fmt(opts?.bucket);
      const regionStr = fmt(opts?.region);
      const endpointSuffix =
        typeof opts?.endpoint === 'string' ? ` endpoint=${opts.endpoint}` : '';
      this.logger.log(
        `[routers OSS] 准备拉取对象 objectKey=${JSON.stringify(
          this.objectKey,
        )} bucket=${bucketStr} region=${regionStr}${endpointSuffix}`,
      );
      const result = await this.oss.get(this.objectKey);
      const status = (result as { res?: { status?: number } }).res?.status;
      this.logger.log(
        `[routers OSS] oss.get 已完成，HTTP status=${
          status ?? 'n/a'
        }（有状态码说明本次已与 OSS 端完成一次请求；若正文异常再查代理/Key/桶）`,
      );
      const text = Buffer.isBuffer(result.content)
        ? result.content.toString('utf8')
        : String(result.content);
      const parsed = JSON.parse(text) as unknown;
      if (looksLikeHttpErrorJsonBody(parsed)) {
        throw new BadGatewayException(
          `OSS 对象「${this.objectKey}」正文像 HTTP 404 错误 JSON（${parsed.message}），不是 routers 配置。请对照本地核对服务端 ALIOSS_REGION、ALIOSS_BUCKET、ALIOSS_ACCESS_KEY_*、ALIOSS_ROUTERS_OBJECT_KEY；并确认访问 OSS API 未被网关/代理指到本应用或其它 Web 服务。`,
        );
      }
      const doc = parseRoutersDocument(parsed);
      this.setCachedDoc(doc);
      return doc;
    } catch (err) {
      // 首次尚无对象：与「空 routers」等价，同样缓存，避免反复 404
      if (isOssNotFound(err)) {
        const empty: RoutersDocument = {
          version: DEFAULT_ROUTERS_DOC_VERSION,
          apps: [],
        };
        this.setCachedDoc(empty);
        return empty;
      }
      throw err;
    }
  }

  private async persistToOss(doc: RoutersDocument): Promise<void> {
    await this.oss.put(
      this.objectKey,
      Buffer.from(JSON.stringify(doc, null, 2), 'utf8'),
      {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
    // 与 OSS 对齐的那份作为新缓存，并刷新 TTL 起点
    this.setCachedDoc(doc);
  }

  async saveDocument(doc: RoutersDocument): Promise<void> {
    // 先走 Zod，得到「可落盘」快照（与就地改的 doc 可能不是同一引用）
    const normalized = parseRoutersDocument(doc);
    await this.persistToOss(normalized);
  }

  /** 在当前文档中按 id 查找 app，不存在则 404 */
  private findAppOrThrow(doc: RoutersDocument, id: string): RouterAppEntry {
    const app = doc.apps.find((a) => a.id === id);
    if (!app) {
      throw new NotFoundException(`未找到 app: ${id}`);
    }
    return app;
  }

  async getApp(id: string): Promise<RouterAppEntry> {
    const doc = await this.getDocument();
    return this.findAppOrThrow(doc, id);
  }

  /**
   * 不存在则 create（带首条 publish），已存在则 publish 新版本。
   */
  async deployApp(body: DeployAppDto): Promise<RouterAppEntry> {
    const doc = await this.getDocument();
    const exists = doc.apps.some((a) => a.id === body.id);
    if (!exists) {
      const now = new Date().toISOString();
      return this.createApp({
        id: body.id,
        domain: body.domain,
        path: body.path,
        enable: body.enable ?? true,
        currentVersion: body.version,
        ossIndexUrl: body.ossIndexUrl,
        config: body.config,
        publishList: [
          {
            version: body.version,
            ossIndexUrl: body.ossIndexUrl,
            publishedAt: now,
            note: body.note ?? 'initial',
          },
        ],
      });
    }
    return this.publish(body.id, {
      version: body.version,
      ossIndexUrl: body.ossIndexUrl,
      note: body.note,
    });
  }

  async createApp(body: CreateAppDto): Promise<RouterAppEntry> {
    const doc = await this.getDocument();
    if (doc.apps.some((a) => a.id === body.id)) {
      throw new BadRequestException(`app id 已存在: ${body.id}`);
    }
    const now = new Date().toISOString();
    // 未带历史时：用当前版本造一条「首条发布」，便于后续 publish/rollback 与列表一致
    const publishList =
      body.publishList && body.publishList.length > 0
        ? [...body.publishList]
        : [
            {
              version: body.currentVersion,
              ossIndexUrl: body.ossIndexUrl,
              publishedAt: now,
              note: 'initial',
            },
          ];
    const versions = new Set(publishList.map((p) => p.version));
    if (versions.size !== publishList.length) {
      throw new BadRequestException('publishList 中存在重复 version');
    }
    const app: RouterAppEntry = {
      id: body.id,
      domain: body.domain,
      path: body.path,
      enable: body.enable ?? true,
      config: body.config,
      currentVersion: body.currentVersion,
      ossIndexUrl: body.ossIndexUrl,
      publishList,
    };
    doc.apps.push(app);
    await this.saveDocument(doc);
    return app;
  }

  async patchApp(id: string, body: PatchAppDto): Promise<RouterAppEntry> {
    const doc = await this.getDocument();
    const cur = this.findAppOrThrow(doc, id);
    if (body.domain !== undefined) cur.domain = body.domain;
    if (body.path !== undefined) cur.path = body.path;
    if (body.enable !== undefined) cur.enable = body.enable;
    if (body.config !== undefined) cur.config = body.config;
    await this.saveDocument(doc);
    return cur;
  }

  async deleteApp(id: string): Promise<void> {
    const doc = await this.getDocument();
    this.findAppOrThrow(doc, id);
    doc.apps = doc.apps.filter((a) => a.id !== id);
    await this.saveDocument(doc);
  }

  async publish(id: string, body: PublishDto): Promise<RouterAppEntry> {
    const doc = await this.getDocument();
    const app = this.findAppOrThrow(doc, id);
    if (app.publishList.some((p) => p.version === body.version)) {
      throw new BadRequestException(
        `版本号已存在，禁止重复发布: ${body.version}`,
      );
    }
    const publishedAt = new Date().toISOString();
    // 追加历史 + 把「当前指针」指到新版本（与 rollback 只改指针、不追加记录形成对比）
    app.publishList = [
      ...app.publishList,
      {
        version: body.version,
        ossIndexUrl: body.ossIndexUrl,
        publishedAt,
        note: body.note,
      },
    ];
    app.currentVersion = body.version;
    app.ossIndexUrl = body.ossIndexUrl;
    await this.saveDocument(doc);
    return app;
  }

  async rollback(body: RollbackDto): Promise<RouterAppEntry> {
    const doc = await this.getDocument();
    const app = this.findAppOrThrow(doc, body.id);
    const hit = app.publishList.find((p) => p.version === body.version);
    if (!hit) {
      throw new NotFoundException(`发布历史中无此版本: ${body.version}`);
    }
    // 仅回滚指针，不新增 publishList 条目（与 publish 不同）
    app.currentVersion = hit.version;
    app.ossIndexUrl = hit.ossIndexUrl;
    await this.saveDocument(doc);
    return app;
  }

  async replaceDocument(doc: RoutersDocumentDto): Promise<RoutersDocument> {
    const normalized = parseRoutersDocument(doc);
    // 整包覆盖：不经过 getDocument 再改 apps，直接写 OSS 并 setCachedDoc
    await this.persistToOss(normalized);
    return normalized;
  }
}
