import { describe, expect, it } from 'vitest';

import {
  getAppMode,
  getArUrl,
  getMissingModelMessage,
  getModeConfig,
  getPageCopy,
  getViewerUrl,
  shouldDestroyOnPageHide,
  shouldInitializeAnimationController,
} from '../src/app-mode';
import {
  ANIMATED_MODEL_PATH,
  AR_MODEL_PATH,
} from '../src/model-config';

describe('应用模式', () => {
  it('无 mode 参数时进入 viewer 模式', () => {
    expect(getAppMode(new URLSearchParams())).toBe('viewer');
  });

  it('mode=ar 时进入 AR 模式', () => {
    expect(getAppMode(new URLSearchParams('mode=ar'))).toBe('ar');
  });

  it('未知 mode 安全回退到 viewer 模式', () => {
    expect(getAppMode(new URLSearchParams('mode=vr'))).toBe('viewer');
  });

  it('两个模式只选择各自的模型和控制器', () => {
    expect(getModeConfig('viewer')).toEqual({
      modelPath: ANIMATED_MODEL_PATH,
      initializeAnimations: true,
      enableAr: false,
      autoRotate: true,
    });
    expect(getModeConfig('ar')).toEqual({
      modelPath: AR_MODEL_PATH,
      initializeAnimations: false,
      enableAr: true,
      autoRotate: false,
    });
    expect(shouldInitializeAnimationController('viewer')).toBe(true);
    expect(shouldInitializeAnimationController('ar')).toBe(false);
  });

  it('AR模式使用专用标题和模型缺失中文提示', () => {
    expect(getPageCopy('ar')).toEqual({
      title: '六通鲁班锁 AR 查看',
      subtitle: '将约7.5厘米的鲁班锁放到现实桌面中',
      regionLabel: '六通鲁班锁AR预览模式',
    });
    expect(getMissingModelMessage('ar')).toBe(
      '未找到AR模型，请运行 npm run model:ar。',
    );
    expect(getMissingModelMessage('viewer')).toContain(
      'public/models/luban-lock.glb',
    );
  });

  it('进入 AR 时保留 UTM 并移除动画缺失模拟参数', () => {
    const url = getArUrl(
      new URLSearchParams('utm_source=wechat&simulate-missing-animation=Assemble'),
      '/demo/',
    );

    expect(url).toBe('/demo/?utm_source=wechat&mode=ar');
  });

  it('返回 viewer 时只移除 mode 和 AR 测试参数', () => {
    const url = getViewerUrl(
      new URLSearchParams(
        'mode=ar&utm_source=wechat&simulate-ar-missing=1&simulate-missing-animation=Assemble',
      ),
      '/demo/',
    );

    expect(url).toBe('/demo/?utm_source=wechat&simulate-missing-animation=Assemble');
  });

  it('BFCache pagehide保留控制器，真正卸载时才销毁', () => {
    expect(shouldDestroyOnPageHide(true)).toBe(false);
    expect(shouldDestroyOnPageHide(false)).toBe(true);
  });
});
