// @ts-nocheck -- Node内置HTTP夹具测试，不为浏览器代码新增@types/node依赖。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ensureNoHttpDowngrade,
  requestWithTimeout,
  validateDeploymentUrl,
  verifyDeployment,
  verifyImmutableAssetCache,
  verifyHtmlPayload,
  verifyMissingModelPayload,
  verifyModelPayload,
} from '../scripts/verify-deployment.mjs';
import {
  parseGlb,
  serializeGlbWithJson,
  sha256,
} from '../scripts/lib/static-ar-glb.mjs';

let animatedModel: Buffer;
let arModel: Buffer;

beforeAll(async () => {
  [animatedModel, arModel] = await Promise.all([
    readFile('public/models/luban-lock.glb'),
    readFile('public/models/luban-lock-ar.glb'),
  ]);
});

function modelPayload(
  buffer: Buffer,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    label: '测试模型',
    status: 200,
    contentType: 'model/gltf-binary',
    cors: '*',
    cacheControl: 'public, max-age=3600, must-revalidate',
    buffer,
    expectedHash: sha256(buffer),
    expectedAnimations: [],
    ...overrides,
  };
}

function startFixtureServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (url.pathname === '/models/luban-lock.glb') {
      response.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      });
      response.end(animatedModel);
      return;
    }
    if (url.pathname === '/models/luban-lock-ar.glb') {
      response.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      });
      response.end(arModel);
      return;
    }
    if (url.pathname === '/models/__deployment-check-missing__.glb') {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('not found');
      return;
    }
    if (url.pathname === '/assets/index-abc123.js') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      response.end('export {};');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(
      '<!doctype html><title>六通鲁班锁</title><script type="module" src="/assets/index-abc123.js"></script>',
    );
  });
  return server;
}

describe('部署URL验证', () => {
  it('缺少URL参数时报错', () => {
    expect(() => validateDeploymentUrl(undefined)).toThrow(/URL/u);
  });

  it('非法URL时报错', () => {
    expect(() => validateDeploymentUrl('not a url')).toThrow(/URL/u);
  });

  it('正式HTTP地址被拒绝', () => {
    expect(() => validateDeploymentUrl('http://example.com')).toThrow(/HTTPS/u);
  });

  it('HTTPS地址格式通过并移除末尾斜杠', () => {
    expect(validateDeploymentUrl('https://example.pages.dev/').href).toBe(
      'https://example.pages.dev/',
    );
  });
});

describe('页面与模型响应验证纯函数', () => {
  it('根页面200和项目标题通过', () => {
    expect(() =>
      verifyHtmlPayload({
        label: '根页面',
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<title>六通鲁班锁</title>',
      }),
    ).not.toThrow();
  });

  it('根页面404失败', () => {
    expect(() =>
      verifyHtmlPayload({
        label: '根页面',
        status: 404,
        contentType: 'text/html',
        body: '<title>六通鲁班锁</title>',
      }),
    ).toThrow(/404/u);
  });

  it('AR页面200通过', () => {
    expect(() =>
      verifyHtmlPayload({
        label: 'AR页面',
        status: 200,
        contentType: 'text/html',
        body: '<title>六通鲁班锁 AR 查看</title>',
      }),
    ).not.toThrow();
  });

  it.each(['普通模型', 'AR模型'])('%s内容类型错误时失败', (label) => {
    expect(() =>
      verifyModelPayload(
        modelPayload(arModel, { label, contentType: 'text/html' }),
      ),
    ).toThrow(/Content-Type/u);
  });

  it('普通模型哈希不一致时失败', () => {
    expect(() =>
      verifyModelPayload(
        modelPayload(animatedModel, {
          expectedHash: '0'.repeat(64),
          expectedAnimations: ['Assemble', 'Disassemble'],
        }),
      ),
    ).toThrow(/SHA-256/u);
  });

  it('AR模型哈希不一致时失败', () => {
    expect(() =>
      verifyModelPayload(
        modelPayload(arModel, { expectedHash: 'F'.repeat(64) }),
      ),
    ).toThrow(/SHA-256/u);
  });

  it('普通模型动画缺失时失败', () => {
    const parsed = parseGlb(animatedModel);
    const json = structuredClone(parsed.json);
    json.animations = [{ name: 'Assemble' }];
    const missingAnimation = serializeGlbWithJson(parsed, json);

    expect(() =>
      verifyModelPayload(
        modelPayload(missingAnimation, {
          expectedHash: sha256(missingAnimation),
          expectedAnimations: ['Assemble', 'Disassemble'],
        }),
      ),
    ).toThrow(/动画/u);
  });

  it('AR模型仍包含动画时失败', () => {
    expect(() =>
      verifyModelPayload(
        modelPayload(animatedModel, {
          expectedHash: sha256(animatedModel),
          expectedAnimations: [],
        }),
      ),
    ).toThrow(/动画/u);
  });

  it('缺失模型路径返回200时失败', () => {
    expect(() =>
      verifyMissingModelPayload({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html>',
      }),
    ).toThrow(/404/u);
  });

  it('缺失模型路径返回404时通过', () => {
    expect(() =>
      verifyMissingModelPayload({
        status: 404,
        contentType: 'text/plain',
        body: 'not found',
      }),
    ).not.toThrow();
  });

  it('CORS响应头缺失时失败', () => {
    expect(() =>
      verifyModelPayload(modelPayload(arModel, { cors: null })),
    ).toThrow(/CORS|Access-Control-Allow-Origin/u);
  });

  it('拒绝用相似子串伪装的GLB缓存指令', () => {
    expect(() =>
      verifyModelPayload(
        modelPayload(arModel, {
          cacheControl: 'public, max-age=36000, not-must-revalidate',
        }),
      ),
    ).toThrow(/Cache-Control/u);
  });

  it.each([
    'public, max-age=3600, must-revalidate, s-maxage=31536000',
    'public, max-age=99999, max-age=3600, must-revalidate',
    'public, max-age=3600, must-revalidate, immutable',
    'public, max-age=3600, must-revalidate, no-store',
  ])('拒绝覆盖或冲突的GLB缓存策略：%s', (cacheControl) => {
    expect(() =>
      verifyModelPayload(modelPayload(arModel, { cacheControl })),
    ).toThrow(/Cache-Control|缓存/u);
  });

  it('哈希资源缓存指令必须精确匹配', () => {
    expect(() =>
      verifyImmutableAssetCache('public, max-age=315360000, not-immutable'),
    ).toThrow(/immutable/u);
    expect(() =>
      verifyImmutableAssetCache('public, max-age=31536000, immutable'),
    ).not.toThrow();
  });

  it.each([
    'public, max-age=31536000, immutable, no-store',
    'public, max-age=31536000, immutable, private',
    'public, max-age=1, max-age=31536000, immutable',
  ])('拒绝冲突的哈希资源缓存策略：%s', (cacheControl) => {
    expect(() => verifyImmutableAssetCache(cacheControl)).toThrow(
      /Cache-Control|缓存/u,
    );
  });

  it('HTTPS响应重定向到HTTP时失败', () => {
    expect(() =>
      ensureNoHttpDowngrade(
        new URL('https://example.pages.dev/'),
        new URL('http://example.pages.dev/'),
      ),
    ).toThrow(/HTTP/u);
  });
});

describe('网络超时与本地HTTP夹具', () => {
  it('请求超时时安全退出', async () => {
    const server = createServer(() => undefined);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    try {
      await expect(
        requestWithTimeout(`http://127.0.0.1:${address.port}/slow`, {
          timeoutMs: 30,
        }),
      ).rejects.toThrow(/超时/u);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('响应头已返回但正文停滞时仍会超时', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.write('partial');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    try {
      await expect(
        requestWithTimeout(`http://127.0.0.1:${address.port}/slow-body`, {
          timeoutMs: 30,
        }),
      ).rejects.toThrow(/超时/u);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('完整本地夹具通过全部页面、模型、响应头、缓存和404检查', async () => {
    const server = startFixtureServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    try {
      const report = await verifyDeployment(
        `http://127.0.0.1:${address.port}`,
        { allowHttpLocalhost: true, timeoutMs: 2_000 },
      );

      expect(report.baseUrl).toContain('127.0.0.1');
      expect(report.checks).toContain('缺失模型404');
      expect(report.animatedModelHash).toBe(sha256(animatedModel));
      expect(report.arModelHash).toBe(sha256(arModel));
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    expect(server.listening).toBe(false);
  }, 15_000);

  it('本地测试服务器关闭后不残留监听进程', async () => {
    const server = startFixtureServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(server.listening).toBe(false);
  });
});
