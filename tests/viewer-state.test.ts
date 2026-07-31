import { describe, expect, it } from 'vitest';

import {
  clampProgress,
  initialAutoRotate,
  statusCopy,
} from '../src/viewer-state';

describe('clampProgress', () => {
  it('将进度限制在 0 到 100 的整数百分比', () => {
    expect(clampProgress(-0.1)).toBe(0);
    expect(clampProgress(0.426)).toBe(43);
    expect(clampProgress(2)).toBe(100);
  });
});

describe('initialAutoRotate', () => {
  it('在减少动态时默认关闭自动旋转', () => {
    expect(initialAutoRotate(true)).toBe(false);
    expect(initialAutoRotate(false)).toBe(true);
  });
});

describe('statusCopy', () => {
  it('为缺少模型和加载失败返回明确中文信息', () => {
    expect(statusCopy('missing')).toContain('public/models/luban-lock.glb');
    expect(statusCopy('error')).toContain('3D模型加载失败');
  });
});
