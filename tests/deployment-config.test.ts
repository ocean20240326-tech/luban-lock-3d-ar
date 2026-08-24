// @ts-nocheck -- 部署契约读取Node侧文件，不为浏览器代码增加@types/node。
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve('.');

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe('Cloudflare Pages部署契约', () => {
  it('.node-version固定为本地验证过的Node版本', async () => {
    await expect(readFile('.node-version', 'utf8')).resolves.toBe('24.15.0\n');
  });

  it('保留prebuild并提供三个跨平台部署命令', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

    expect(packageJson.scripts.prebuild).toBe('npm run model:ar');
    expect(packageJson.scripts['deploy:dist']).toBe(
      'node scripts/verify-dist.mjs',
    );
    expect(packageJson.scripts['deploy:check']).toBe(
      'npm run test && npm run build && npm run deploy:dist',
    );
    expect(packageJson.scripts['deploy:verify']).toBe(
      'node scripts/verify-deployment.mjs',
    );
  });

  it('public/_headers包含站点安全头和GLB专用MIME/CORS', async () => {
    const headers = await readFile('public/_headers', 'utf8');

    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain(
      'Referrer-Policy: strict-origin-when-cross-origin',
    );
    expect(headers).toContain('/models/*.glb');
    expect(headers).toContain('Content-Type: model/gltf-binary');
    expect(headers).toContain('Content-Disposition: inline');
    expect(headers).toContain('Access-Control-Allow-Origin: *');
  });

  it('哈希资源长期缓存，而稳定GLB文件名不使用一年immutable', async () => {
    const headers = await readFile('public/_headers', 'utf8');
    const assetBlock = headers.match(/\/assets\/\*[\s\S]*?(?=\n\/|$)/u)?.[0];
    const modelBlock = headers.match(/\/models\/\*\.glb[\s\S]*$/u)?.[0];

    expect(assetBlock).toContain(
      'Cache-Control: public, max-age=31536000, immutable',
    );
    expect(modelBlock).toContain(
      'Cache-Control: public, max-age=3600, must-revalidate',
    );
    expect(modelBlock).not.toContain('immutable');
    expect(modelBlock).not.toContain('31536000');
  });

  it('_headers不添加会破坏AR的安全策略', async () => {
    const headers = (await readFile('public/_headers', 'utf8')).toLowerCase();

    expect(headers).not.toContain('cross-origin-resource-policy: same-origin');
    expect(headers).not.toContain('camera=()');
    expect(headers).not.toContain('xr-spatial-tracking=()');
    expect(headers).not.toContain('strict-transport-security');
  });

  it('不存在危险SPA catch-all重写', async () => {
    if (!(await exists('public/_redirects'))) {
      expect(await exists('public/_redirects')).toBe(false);
      return;
    }

    const redirects = await readFile('public/_redirects', 'utf8');
    expect(redirects).not.toMatch(/^\s*\/\*\s+\/index\.html\s+200\s*$/mu);
  });

  it('提供Cloudflare Pages顶层404页面以关闭默认SPA回退', async () => {
    const notFoundPage = await readFile('public/404.html', 'utf8');

    expect(notFoundPage).toContain('404');
    expect(notFoundPage).toContain('六通鲁班锁');
    expect(notFoundPage).not.toMatch(/C:[\\/]Users[\\/]/iu);
  });

  it('Vite使用MPA回退语义，让缺失GLB在本地预览中真实返回404', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8');

    expect(viteConfig).toMatch(/appType:\s*['"]mpa['"]/u);
    expect(viteConfig).not.toMatch(/base\s*:/u);
  });

  it('保持纯静态架构且没有Cloudflare运行时入口', async () => {
    await expect(exists('functions')).resolves.toBe(false);
    await expect(exists('_worker.js')).resolves.toBe(false);
    await expect(exists('wrangler.toml')).resolves.toBe(false);
    await expect(exists('wrangler.json')).resolves.toBe(false);
  });

  it('.gitignore覆盖构建产物、日志、环境文件和Wrangler状态', async () => {
    const gitignore = await readFile('.gitignore', 'utf8');

    for (const rule of [
      'node_modules/',
      'dist/',
      '*.log',
      '.env',
      '.env.*',
      '!.env.example',
      '.dev.vars',
      '.dev.vars.*',
      '.wrangler/',
    ]) {
      expect(gitignore.split(/\r?\n/u)).toContain(rule);
    }
    expect(gitignore).not.toContain('public/models/');
    expect(gitignore).not.toContain('public/_headers');
  });
});
