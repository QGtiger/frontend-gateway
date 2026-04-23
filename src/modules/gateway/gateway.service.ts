import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import type { RouterAppEntry } from '../alioss/routers.types';
import { RoutersService } from '../alioss/routers.service';

function normalizePath(p: string): string {
  let s = p.split('?')[0] || '/';
  if (!s.startsWith('/')) {
    s = `/${s}`;
  }
  if (s.length > 1 && s.endsWith('/')) {
    s = s.slice(0, -1);
  }
  return s || '/';
}

function normalizeHost(host: string | undefined): string {
  return (host || '').split(':')[0].toLowerCase();
}

/**
 * 在 enable 的条目中，按 domain/path 匹配；多命中时 path 更长者优先（更具体）。
 */
export function matchRouterApp(
  apps: RouterAppEntry[],
  host: string,
  pathname: string,
): RouterAppEntry | undefined {
  const hostNorm = normalizeHost(host);
  const pathNorm = normalizePath(pathname);
  const candidates = apps.filter((a) => a.enable !== false);
  const matched: RouterAppEntry[] = [];

  for (const app of candidates) {
    if (!app.domain && !app.path) {
      continue;
    }
    if (app.domain) {
      const d = normalizeHost(app.domain);
      if (hostNorm !== d) {
        continue;
      }
    }
    if (app.path) {
      const base = normalizePath(app.path);
      if (pathNorm !== base && !pathNorm.startsWith(`${base}/`)) {
        continue;
      }
    }
    matched.push(app);
  }

  matched.sort((a, b) => {
    const score = (x: RouterAppEntry) =>
      (x.path?.length ?? 0) * 10 + (x.domain ? 1 : 0);
    return score(b) - score(a);
  });

  return matched[0];
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(private readonly routersService: RoutersService) {}

  async resolveApp(
    host: string | undefined,
    pathname: string,
  ): Promise<RouterAppEntry | undefined> {
    const doc = await this.routersService.getDocument();
    return matchRouterApp(doc.apps, host, pathname);
  }

  /**
   * 拉取 ossIndexUrl 对应 HTML，并在 </head> 前注入 `window.__ROUTER_APP_CONFIG__`（来自 app.config）。
   */
  async buildHtmlResponse(
    app: RouterAppEntry & {
      html?: string;
    },
  ): Promise<string> {
    if (app.html) {
      this.logger.log('命中缓存');
      return app.html;
    }
    const res = await fetch(app.ossIndexUrl, {
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
    });
    if (!res.ok) {
      this.logger.warn(`拉取 HTML 失败 ${res.status}: ${app.ossIndexUrl}`);
      throw new BadGatewayException(`上游 HTML 返回 ${res.status}`);
    }
    const html = await res.text();
    const configJson = JSON.stringify({
      ...app.config,
      version: app.currentVersion,
      appName: app.id,
    });
    const inject = `<script>window.__ROUTER_APP_CONFIG__=${configJson};</script>`;

    let htmlStr = `${inject}${html}`;
    if (html.includes('</head>')) {
      htmlStr = html.replace('</head>', `${inject}</head>`);
    }
    app.html = htmlStr;
    return htmlStr;
  }
}
