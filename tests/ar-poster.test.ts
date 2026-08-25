// @ts-nocheck -- 仅验证静态预览资源，不为测试脚本增加Node类型依赖。
import { readFile, stat } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { AR_MODEL_POSTER_PATH } from '../src/model-config';

const POSTER_FILE = `public${AR_MODEL_POSTER_PATH}`;

describe('AR首次加载轻量预览图', () => {
  it('使用本地JPEG文件且不依赖远程资源', () => {
    expect(AR_MODEL_POSTER_PATH).toBe('/images/luban-lock-ar-poster.jpg');
    expect(AR_MODEL_POSTER_PATH).not.toMatch(/^https?:/u);
  });

  it('预览图是有效且足够轻量的JPEG文件', async () => {
    const [bytes, file] = await Promise.all([
      readFile(POSTER_FILE),
      stat(POSTER_FILE),
    ]);

    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(file.size).toBeGreaterThan(1_000);
    expect(file.size).toBeLessThan(100_000);
  });
});
