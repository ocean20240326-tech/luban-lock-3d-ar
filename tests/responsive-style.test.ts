// @ts-nocheck -- 样式回归测试读取Node侧文件，不为浏览器代码增加@types/node。
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

function getRuleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'u'));

  if (!match) {
    throw new Error(`未找到${selector}样式规则`);
  }

  return match[1];
}

describe('移动端窄屏样式', () => {
  it('根元素可以缩小到滚动条扣除后的可用宽度', async () => {
    const css = await readFile('src/style.css', 'utf8');

    expect(getRuleBody(css, 'html')).not.toMatch(/min-width\s*:\s*320px/iu);
    expect(getRuleBody(css, 'body')).not.toMatch(/min-width\s*:\s*320px/iu);
  });
});
