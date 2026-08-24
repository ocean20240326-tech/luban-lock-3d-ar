import { describe, expect, it } from 'vitest';

import html from '../index.html?raw';

describe('拆装演示页面契约', () => {
  it('关闭动画交叉淡化且不设置 autoplay', () => {
    const modelViewerMarkup = html.match(/<model-viewer[\s\S]*?<\/model-viewer>/)?.[0];

    expect(modelViewerMarkup).toContain('animation-crossfade-duration="0"');
    expect(modelViewerMarkup).not.toMatch(/\sautoplay(?:\s|=|>)/);
  });

  it('包含状态 live region 和可访问的动画进度条', () => {
    expect(html).toMatch(/id="animationStatus"[\s\S]*?aria-live="polite"/);
    expect(html).toMatch(/id="animationProgressBar"[\s\S]*?role="progressbar"/);
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuenow="0"');
  });

  it.each([
    ['disassembleButton', '播放鲁班锁拆解演示'],
    ['assembleButton', '播放鲁班锁重新组装动画'],
    ['pauseResumeButton', '暂停拆装动画'],
    ['resetModelButton', '将鲁班锁重置为完整组装状态'],
  ])('%s 使用原生禁用 button 和清晰 aria-label', (id, ariaLabel) => {
    const button = html.match(new RegExp(`<button[\\s\\S]*?id="${id}"[\\s\\S]*?</button>`))?.[0];

    expect(button).toContain('type="button"');
    expect(button).toContain(`aria-label="${ariaLabel}"`);
    expect(button).toMatch(/\sdisabled(?:\s|>)/);
  });
});
