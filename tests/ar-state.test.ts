import { describe, expect, it } from 'vitest';

import {
  canOfferAr,
  getArButtonState,
  getArStatusMessage,
  isArStatusEventDetail,
  mapArStatus,
  resolveArSupport,
  shouldShowUnavailableArButton,
} from '../src/ar-state';

describe('AR 支持检测', () => {
  it('模型未加载时保持 checking 且按钮禁用', () => {
    expect(
      resolveArSupport({
        modelLoaded: false,
        isSecureContext: true,
        canActivateAR: true,
      }),
    ).toBe('checking');
    expect(getArButtonState('checking').disabled).toBe(true);
  });

  it('安全上下文且 canActivateAR=true 时进入 ready', () => {
    expect(
      resolveArSupport({
        modelLoaded: true,
        isSecureContext: true,
        canActivateAR: true,
      }),
    ).toBe('ready');
    expect(canOfferAr('ready')).toBe(true);
  });

  it('canActivateAR=false 时进入 unsupported', () => {
    expect(
      resolveArSupport({
        modelLoaded: true,
        isSecureContext: true,
        canActivateAR: false,
      }),
    ).toBe('unsupported');
    expect(getArButtonState('unsupported').disabled).toBe(true);
  });

  it('非安全上下文优先进入 insecure-context', () => {
    expect(
      resolveArSupport({
        modelLoaded: true,
        isSecureContext: false,
        canActivateAR: true,
      }),
    ).toBe('insecure-context');
    expect(getArStatusMessage('insecure-context')).toContain('HTTPS');
  });

  it('官方 AR 槽位不可用时提供明确的禁用入口', () => {
    expect(shouldShowUnavailableArButton('unsupported', false)).toBe(true);
    expect(shouldShowUnavailableArButton('insecure-context', false)).toBe(true);
    expect(shouldShowUnavailableArButton('checking', true)).toBe(true);
    expect(shouldShowUnavailableArButton('failed', false)).toBe(true);
    expect(shouldShowUnavailableArButton('ready', false)).toBe(false);
  });
});

describe('ar-status 映射', () => {
  it('只接受 model-viewer 定义的状态详情', () => {
    expect(isArStatusEventDetail({ status: 'session-started' })).toBe(true);
    expect(isArStatusEventDetail({ status: 'object-placed' })).toBe(true);
    expect(isArStatusEventDetail({ status: 'unknown' })).toBe(false);
    expect(isArStatusEventDetail(null)).toBe(false);
  });

  it('session-started 与 object-placed 使用准确中文引导', () => {
    expect(mapArStatus('launching', 'session-started', true)).toBe(
      'session-started',
    );
    expect(getArStatusMessage('session-started')).toBe(
      '请缓慢移动手机寻找水平平面',
    );
    expect(mapArStatus('session-started', 'object-placed', true)).toBe(
      'object-placed',
    );
    expect(getArStatusMessage('object-placed')).toBe('鲁班锁已放置');
  });

  it('failed 进入失败状态但允许再次启动', () => {
    expect(mapArStatus('launching', 'failed', true)).toBe('failed');
    expect(getArButtonState('failed').disabled).toBe(false);
    expect(getArStatusMessage('failed')).toContain('普通3D查看');
  });

  it('启动过后收到 not-presenting 标记 returned', () => {
    expect(mapArStatus('session-started', 'not-presenting', true)).toBe(
      'returned',
    );
    expect(getArButtonState('returned').disabled).toBe(false);
  });

  it('未启动时的 not-presenting 不伪造成功或返回状态', () => {
    expect(mapArStatus('ready', 'not-presenting', false)).toBe('ready');
  });
});
