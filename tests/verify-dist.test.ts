// @ts-nocheck -- Node专用部署集成测试；项目不新增@types/node依赖。
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  verifyDist,
  verifyHeadersConfiguration,
} from '../scripts/verify-dist.mjs';

let root: string;

async function prepareFixture(): Promise<void> {
  root = await mkdtemp(path.join(tmpdir(), 'luban-dist-test-'));
  for (const directory of [
    'public/models',
    'dist/models',
    'dist/assets',
  ]) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  for (const modelName of ['luban-lock.glb', 'luban-lock-ar.glb']) {
    const source = path.resolve('public/models', modelName);
    await copyFile(source, path.join(root, 'public/models', modelName));
    await copyFile(source, path.join(root, 'dist/models', modelName));
  }
  const headers = await readFile('public/_headers', 'utf8');
  await writeFile(path.join(root, 'dist/_headers'), headers);
  await writeFile(
    path.join(root, 'dist/404.html'),
    '<!doctype html><title>404｜六通鲁班锁</title><h1>404</h1>',
  );
  await writeFile(
    path.join(root, 'dist/index.html'),
    '<!doctype html><title>六通鲁班锁</title><script type="module" src="/assets/index-abc123.js"></script>',
  );
  await writeFile(
    path.join(root, 'dist/assets/index-abc123.js'),
    'const viewer="/models/luban-lock.glb";const ar="/models/luban-lock-ar.glb";',
  );
}

beforeEach(prepareFixture);

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('生产构建目录验证器', () => {
  it('接受模型、资源、响应头和路径均正确的纯静态dist', async () => {
    const report = await verifyDist({ projectRoot: root });

    expect(report.fileCount).toBe(6);
    expect(report.animatedModel.animationNames).toEqual([
      'Assemble',
      'Disassemble',
    ]);
    expect(report.arModel.animationNames).toEqual([]);
    expect(report.headersValid).toBe(true);
    expect(report.localPathMatches).toEqual([]);
  });

  it('拒绝dist模型与public模型哈希不一致', async () => {
    const arPath = path.join(root, 'dist/models/luban-lock-ar.glb');
    const corrupted = Buffer.from(await readFile(arPath));
    corrupted[corrupted.length - 1] ^= 1;
    await writeFile(arPath, corrupted);

    await expect(verifyDist({ projectRoot: root })).rejects.toThrow(/AR模型.*哈希/u);
  });

  it('拒绝生产目录中的环境变量文件', async () => {
    await writeFile(path.join(root, 'dist/.env'), 'SHOULD_NOT_DEPLOY=1');

    await expect(verifyDist({ projectRoot: root })).rejects.toThrow(/\.env/u);
  });

  it('拒绝缺少顶层404页面的Cloudflare Pages构建', async () => {
    await unlink(path.join(root, 'dist/404.html'));

    await expect(verifyDist({ projectRoot: root })).rejects.toThrow(/404\.html/u);
  });

  it('单独运行deploy:dist也会拒绝项目根目录Pages Functions', async () => {
    await mkdir(path.join(root, 'functions'));
    await writeFile(path.join(root, 'functions/hello.js'), 'export function onRequest() {}');

    await expect(verifyDist({ projectRoot: root })).rejects.toThrow(/Functions/u);
  });

  it('拒绝本机绝对路径泄漏', async () => {
    await writeFile(
      path.join(root, 'dist/assets/index-abc123.js'),
      'const debugPath="C:/Users/Example/private";',
    );

    await expect(verifyDist({ projectRoot: root })).rejects.toThrow(
      /本机路径|本地地址/u,
    );
  });

  it('响应头验证器拒绝GLB长期immutable缓存', async () => {
    const invalid = `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/models/*.glb\n  Content-Type: model/gltf-binary\n  Content-Disposition: inline\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=31536000, immutable\n`;

    expect(() => verifyHeadersConfiguration(invalid)).toThrow(/GLB.*immutable/u);
  });
});
