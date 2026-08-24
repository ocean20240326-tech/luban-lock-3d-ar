import { describe, expect, it } from 'vitest';

import html from '../index.html?raw';

describe('AR页面静态契约', () => {
  const modelViewerMarkup =
    html.match(/<model-viewer[\s\S]*?<\/model-viewer>/)?.[0] ?? '';

  it('初始HTML不设置src或AR属性，避免模式判断前下载错误模型', () => {
    expect(modelViewerMarkup).not.toMatch(/\ssrc=/u);
    expect(modelViewerMarkup).not.toMatch(/\sar(?:\s|=|>)/u);
    expect(modelViewerMarkup).not.toMatch(/\sar-modes=/u);
    expect(modelViewerMarkup).not.toMatch(/\sar-scale=/u);
    expect(modelViewerMarkup).not.toMatch(/\sar-placement=/u);
  });

  it('保留移动预览所需的相机控制和纵向页面手势声明', () => {
    expect(modelViewerMarkup).toMatch(/\scamera-controls(?:\s|>)/u);
    expect(modelViewerMarkup).toContain('touch-action="pan-y"');
  });

  it('提供model-viewer官方自定义AR按钮slot且默认禁用', () => {
    const button = modelViewerMarkup.match(
      /<button[\s\S]*?id="activateArButton"[\s\S]*?<\/button>/u,
    )?.[0];

    expect(button).toContain('slot="ar-button"');
    expect(button).toContain('aria-label="将鲁班锁放到现实中"');
    expect(button).toMatch(/\sdisabled(?:\s|>)/u);
  });

  it('提供不支持设备仍可见的原生禁用AR按钮', () => {
    const button = html.match(
      /<button[\s\S]*?id="unavailableArButton"[\s\S]*?<\/button>/u,
    )?.[0];

    expect(button).toContain('aria-label="当前设备暂不支持将鲁班锁放到现实中"');
    expect(button).toMatch(/\sdisabled(?:\s|>)/u);
  });

  it('普通模式入口和返回按钮都是清晰标注的button', () => {
    expect(html).toMatch(
      /<button[\s\S]*?id="enterArButton"[\s\S]*?aria-label="进入六通鲁班锁AR查看模式"/u,
    );
    expect(html).toMatch(
      /<button[\s\S]*?id="returnViewerButton"[\s\S]*?aria-label="返回六通鲁班锁3D拆装模式"/u,
    );
  });

  it('AR状态使用polite live region并提供完整操作说明', () => {
    expect(html).toMatch(/id="arStatus"[\s\S]*?aria-live="polite"/u);
    expect(html).toContain('将手机对准光线充足、有纹理的水平桌面');
    expect(html).toContain('模型按约7.5厘米真实尺寸展示');
    expect(html).toContain('AR模式暂不播放拆装动画');
  });
});
