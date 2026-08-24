// @ts-nocheck -- Node侧静态部署文件检查，不为浏览器代码增加Node类型依赖。
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FILE_NAME = '2249b344d4373f391d15491e9acb1cdb.txt';
const EXPECTED_CONTENT = '21950d472cee9ee2deb651e1a8861b2911c2cd2d';

describe('微信团队网站根目录验证文件', () => {
  it('public文件名与内容精确匹配且不含BOM', async () => {
    const bytes = await readFile(path.join(process.cwd(), 'public', FILE_NAME));
    const text = bytes.toString('utf8');

    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(
      false,
    );
    expect(text.trim()).toBe(EXPECTED_CONTENT);
    expect(text.trim()).toMatch(/^[a-f0-9]+$/u);
  });
});
