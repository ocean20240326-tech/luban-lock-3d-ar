import { describe, expect, it } from 'vitest';

import { configureModelViewerForMode } from '../src/model-viewer-mode';

class FakeAttributeTarget {
  readonly attributes = new Map<string, string>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  toggleAttribute(name: string, force?: boolean): boolean {
    if (force) {
      this.attributes.set(name, '');
      return true;
    }
    this.attributes.delete(name);
    return false;
  }
}

describe('model-viewer 模式属性', () => {
  it('AR模式设置官方AR后端、固定比例和水平面放置', () => {
    const target = new FakeAttributeTarget();

    configureModelViewerForMode(target, 'ar');

    expect(Object.fromEntries(target.attributes)).toMatchObject({
      ar: '',
      'ar-modes': 'webxr scene-viewer quick-look',
      'ar-scale': 'fixed',
      'ar-placement': 'floor',
      alt: '六通鲁班锁AR模型',
    });
    expect(target.attributes.has('scale')).toBe(false);
    expect(target.attributes.has('ios-src')).toBe(false);
    expect(target.attributes.has('autoplay')).toBe(false);
  });

  it('viewer模式移除全部AR专用属性', () => {
    const target = new FakeAttributeTarget();
    configureModelViewerForMode(target, 'ar');

    configureModelViewerForMode(target, 'viewer');

    expect(target.attributes.has('ar')).toBe(false);
    expect(target.attributes.has('ar-modes')).toBe(false);
    expect(target.attributes.has('ar-scale')).toBe(false);
    expect(target.attributes.has('ar-placement')).toBe(false);
    expect(target.attributes.get('alt')).toBe('六通鲁班锁3D模型');
  });
});
