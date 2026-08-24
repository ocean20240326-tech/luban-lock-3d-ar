// @ts-nocheck -- 只验证HTML中的早期预加载脚本，不增加DOM测试依赖。
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

async function preloadScript(): Promise<string> {
  const html = await readFile('index.html', 'utf8');
  const match = html.match(
    /<script id="earlyModelPreload">(?<source>[\s\S]*?)<\/script>/u,
  );
  if (!match?.groups?.source) {
    throw new Error('index.html缺少earlyModelPreload脚本');
  }
  return match.groups.source;
}

async function runPreload(search: string) {
  const appended: Record<string, unknown>[] = [];
  const document = {
    createElement(tagName: string) {
      expect(tagName).toBe('link');
      return {} as Record<string, unknown>;
    },
    head: {
      append(element: Record<string, unknown>) {
        appended.push(element);
      },
    },
  };
  const window = { location: { search } };
  const execute = new Function('window', 'document', await preloadScript());
  execute(window, document);
  return appended;
}

describe('微信首次打开时的模型早期预加载', () => {
  it('普通模式只预加载动画模型并提高请求优先级', async () => {
    const [link] = await runPreload('?utm_source=wechat');

    expect(link).toMatchObject({
      id: 'modelPreload',
      rel: 'preload',
      as: 'fetch',
      type: 'model/gltf-binary',
      href: '/models/luban-lock.glb',
      crossOrigin: 'anonymous',
      fetchPriority: 'high',
    });
  });

  it('AR模式只预加载静态AR模型', async () => {
    const [link] = await runPreload('?mode=ar&utm_source=wechat');

    expect(link.href).toBe('/models/luban-lock-ar.glb');
  });

  it('未知mode仍回退普通模型且不会同时预加载两个GLB', async () => {
    const links = await runPreload('?mode=unknown');

    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('/models/luban-lock.glb');
  });

  it('AR缺失模拟不预加载真实模型', async () => {
    await expect(
      runPreload('?mode=ar&simulate-ar-missing=1'),
    ).resolves.toEqual([]);
  });

  it('预加载脚本早于Vite主模块且model-viewer仍不静态设置src', async () => {
    const html = await readFile('index.html', 'utf8');

    expect(html.indexOf('id="earlyModelPreload"')).toBeLessThan(
      html.indexOf('type="module" src="/src/main.ts"'),
    );
    expect(html).not.toMatch(/<model-viewer[^>]+\ssrc=/iu);
  });
});
