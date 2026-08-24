import { describe, expect, it } from 'vitest';

import {
  ArController,
  type ArControllerOptions,
  type ArViewer,
} from '../src/ar-controller';
import type { ArState } from '../src/ar-state';

class FakeArViewer extends EventTarget implements ArViewer {
  canActivateAR = true;
  updateCount = 0;
  activationCount = 0;
  activationError: Error | undefined;
  listenerCounts = new Map<string, number>();

  get updateComplete(): Promise<boolean> {
    return Promise.resolve().then(() => {
      this.updateCount += 1;
      return true;
    });
  }

  activateAR(): Promise<void> {
    this.activationCount += 1;
    return this.activationError
      ? Promise.reject(this.activationError)
      : Promise.resolve();
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this.listenerCounts.set(type, (this.listenerCounts.get(type) ?? 0) + 1);
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    this.listenerCounts.set(type, (this.listenerCounts.get(type) ?? 0) - 1);
    super.removeEventListener(type, callback, options);
  }
}

function arStatus(status: string): CustomEvent<unknown> {
  return new CustomEvent('ar-status', { detail: { status } });
}

function arTracking(status: string): CustomEvent<unknown> {
  return new CustomEvent('ar-tracking', { detail: { status } });
}

interface Harness {
  viewer: FakeArViewer;
  controller: ArController;
  states: ArState[];
  tracking: Array<'tracking' | 'not-tracking'>;
}

function createHarness(
  secure = true,
  waitForCapabilityUpdate: () => Promise<void> = async () => undefined,
): Harness {
  const viewer = new FakeArViewer();
  const states: ArState[] = [];
  const tracking: Array<'tracking' | 'not-tracking'> = [];
  const options: ArControllerOptions = {
    isSecureContext: () => secure,
    capabilityCheckAttempts: 3,
    waitForCapabilityUpdate,
    onStateChange: (state) => states.push(state),
    onTrackingChange: (state) => tracking.push(state),
  };
  return {
    viewer,
    controller: new ArController(viewer, options),
    states,
    tracking,
  };
}

describe('ArController', () => {
  it('只注册一次 ar-status 和 ar-tracking 监听器', () => {
    const { viewer } = createHarness();

    expect(viewer.listenerCounts.get('ar-status')).toBe(1);
    expect(viewer.listenerCounts.get('ar-tracking')).toBe(1);
  });

  it('模型更新完成后依据 canActivateAR 进入 ready', async () => {
    const { controller, viewer, states } = createHarness();

    await controller.modelReady();

    expect(viewer.updateCount).toBe(1);
    expect(controller.state).toBe('ready');
    expect(states.at(-1)).toBe('ready');
  });

  it('canActivateAR=false 时进入 unsupported', async () => {
    const { controller, viewer } = createHarness();
    viewer.canActivateAR = false;

    await controller.modelReady();

    expect(controller.state).toBe('unsupported');
  });

  it('等待异步能力选择完成后重新读取 canActivateAR', async () => {
    let checks = 0;
    const harness = createHarness(true, async () => {
      checks += 1;
      harness.viewer.canActivateAR = true;
    });
    harness.viewer.canActivateAR = false;

    await harness.controller.modelReady();

    expect(checks).toBe(1);
    expect(harness.controller.state).toBe('ready');
  });

  it('非安全上下文进入 insecure-context', async () => {
    const { controller } = createHarness(false);

    await controller.modelReady();

    expect(controller.state).toBe('insecure-context');
  });

  it('用户点击同步调用 activateAR、进入 launching 并阻止快速重复请求', async () => {
    const { controller, viewer } = createHarness();
    await controller.modelReady();

    expect(controller.activateAr()).toBe(true);
    expect(controller.state).toBe('launching');
    expect(viewer.activationCount).toBe(1);
    expect(controller.activateAr()).toBe(false);
    expect(viewer.activationCount).toBe(1);
  });

  it('activateAR Promise拒绝时进入failed且不产生未处理拒绝', async () => {
    const { controller, viewer, states } = createHarness();
    const expectedError = new Error('USDZ conversion failed');
    viewer.activationError = expectedError;
    await controller.modelReady();

    expect(controller.activateAr()).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.state).toBe('failed');
    expect(states.at(-1)).toBe('failed');
  });

  it('失败后能力已消失时不发起无效重试并转为unsupported', async () => {
    const { controller, viewer } = createHarness();
    await controller.modelReady();
    viewer.dispatchEvent(arStatus('failed'));
    viewer.canActivateAR = false;

    expect(controller.activateAr()).toBe(false);
    expect(controller.state).toBe('unsupported');
    expect(viewer.activationCount).toBe(0);
  });

  it('ar-status 推进会话、放置和失败状态', async () => {
    const { controller, viewer } = createHarness();
    await controller.modelReady();
    controller.activateAr();

    viewer.dispatchEvent(arStatus('session-started'));
    expect(controller.state).toBe('session-started');
    viewer.dispatchEvent(arStatus('object-placed'));
    expect(controller.state).toBe('object-placed');
    viewer.dispatchEvent(arStatus('failed'));
    expect(controller.state).toBe('failed');
  });

  it('忽略格式错误的 ar-status 并安全处理可选追踪事件', async () => {
    const { controller, viewer, tracking } = createHarness();
    await controller.modelReady();
    viewer.dispatchEvent(arStatus('unexpected'));
    viewer.dispatchEvent(arTracking('not-tracking'));
    viewer.dispatchEvent(arTracking('tracking'));

    expect(controller.state).toBe('ready');
    expect(tracking).toEqual(['not-tracking', 'tracking']);
  });

  it('从外部查看器返回网页后重新启用AR入口但不声称已放置', async () => {
    const { controller } = createHarness();
    await controller.modelReady();
    controller.activateAr();
    controller.pageHidden();
    controller.pageVisible();

    expect(controller.state).toBe('returned');
  });

  it('模型重新加载和销毁会使旧异步检测失效并清理监听器', async () => {
    const { controller, viewer } = createHarness();
    const pending = controller.modelReady();
    controller.prepareForModelLoad();
    await pending;

    expect(controller.state).toBe('checking');
    controller.destroy();
    expect(viewer.listenerCounts.get('ar-status')).toBe(0);
    expect(viewer.listenerCounts.get('ar-tracking')).toBe(0);
  });
});
