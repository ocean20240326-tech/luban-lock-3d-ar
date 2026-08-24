import { describe, expect, it } from 'vitest';

import {
  AnimationController,
  type AnimationControllerOptions,
  type AnimationViewer,
} from '../src/animation-controller';
import type {
  AnimationStateReason,
  PuzzleAnimationState,
} from '../src/animation-state';

class FakeAnimationViewer extends EventTarget implements AnimationViewer {
  availableAnimations = ['Assemble', 'Disassemble'];
  durationByName: Record<string, number> = {
    Assemble: 8,
    Disassemble: 10,
  };
  src = '/models/luban-lock.glb';
  currentTimeAssignments = 0;
  log: string[] = [];
  finishedListenerCount = 0;
  private selectedAnimation: string | undefined;
  private playbackRate = 1;
  private timeline = 0;

  get currentTime(): number {
    return this.timeline;
  }

  set currentTime(value: number) {
    this.timeline = value;
    this.currentTimeAssignments += 1;
  }

  get animationName(): string | undefined {
    return this.selectedAnimation;
  }

  set animationName(value: string | undefined) {
    this.selectedAnimation = value;
    this.log.push(`animation:${value}`);
  }

  get timeScale(): number {
    return this.playbackRate;
  }

  set timeScale(value: number) {
    this.playbackRate = value;
    this.log.push(`timeScale:${value}`);
  }

  get duration(): number {
    return this.selectedAnimation
      ? (this.durationByName[this.selectedAnimation] ?? 0)
      : 0;
  }

  get updateComplete(): Promise<boolean> {
    return Promise.resolve().then(() => {
      this.log.push('updateComplete');
      return true;
    });
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    if (type === 'finished') {
      this.finishedListenerCount += 1;
    }
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    if (type === 'finished') {
      this.finishedListenerCount -= 1;
    }
    super.removeEventListener(type, callback, options);
  }

  pause(): void {
    this.log.push('pause');
  }

  play(options?: { repetitions: number }): void {
    this.log.push(`play:${options?.repetitions ?? 'default'}`);
  }
}

interface ControllerHarness {
  controller: AnimationController;
  viewer: FakeAnimationViewer;
  states: Array<{ state: PuzzleAnimationState; reason: AnimationStateReason }>;
  progress: number[];
  locks: boolean[];
  errors: Error[];
  durations: Array<{ animationName: string; duration: number }>;
  frames: Map<number, FrameRequestCallback>;
  cancelledFrames: number[];
}

function createHarness(): ControllerHarness {
  const viewer = new FakeAnimationViewer();
  const states: ControllerHarness['states'] = [];
  const progress: number[] = [];
  const locks: boolean[] = [];
  const errors: Error[] = [];
  const durations: ControllerHarness['durations'] = [];
  const frames = new Map<number, FrameRequestCallback>();
  const cancelledFrames: number[] = [];
  let nextFrame = 1;

  const options: AnimationControllerOptions = {
    onStateChange: (state, reason) => states.push({ state, reason }),
    onProgress: (value) => progress.push(value),
    onPlaybackLockChange: (locked) => locks.push(locked),
    onError: (error) => errors.push(error),
    onAnimationReady: (animationName, duration) => {
      durations.push({ animationName, duration });
    },
    requestFrame: (callback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelFrame: (id) => {
      cancelledFrames.push(id);
      frames.delete(id);
    },
  };

  return {
    controller: new AnimationController(viewer, options),
    viewer,
    states,
    progress,
    locks,
    errors,
    durations,
    frames,
    cancelledFrames,
  };
}

describe('AnimationController', () => {
  it('只注册一次 finished，并初始化到 Disassemble 第 0 秒的暂停组装姿态', async () => {
    const { controller, viewer, states } = createHarness();

    const result = await controller.initializeAnimations(viewer.src);

    expect(viewer.finishedListenerCount).toBe(1);
    expect(result).toEqual({
      status: 'ready',
      availableAnimations: ['Assemble', 'Disassemble'],
      missingAnimations: [],
    });
    expect(controller.state).toBe('assembled');
    expect(viewer.animationName).toBe('Disassemble');
    expect(viewer.currentTime).toBe(0);
    expect(viewer.timeScale).toBe(1);
    expect(viewer.log).toEqual([
      'pause',
      'animation:Disassemble',
      'updateComplete',
      'timeScale:1',
      'updateComplete',
      'pause',
    ]);
    expect(states.at(-1)).toEqual({ state: 'assembled', reason: 'initialized' });
    expect(viewer.log.some((entry) => entry.startsWith('play:'))).toBe(false);
  });

  it('动画缺失时进入 unavailable 且不尝试播放', async () => {
    const { controller, viewer } = createHarness();
    viewer.availableAnimations = ['Disassemble'];

    const result = await controller.initializeAnimations(viewer.src);

    expect(result.status).toBe('unavailable');
    expect(result.missingAnimations).toEqual(['Assemble']);
    expect(controller.state).toBe('unavailable');
    expect(viewer.log).toEqual(['pause']);
  });

  it('允许开发浏览器传入动画列表覆盖以验证缺失降级', async () => {
    const { controller, viewer } = createHarness();

    const result = await controller.initializeAnimations(viewer.src, [
      'Disassemble',
    ]);

    expect(result.status).toBe('unavailable');
    expect(result.missingAnimations).toEqual(['Assemble']);
    expect(controller.state).toBe('unavailable');
  });

  it('拆解严格按切换顺序单次播放，并拒绝快速重复启动', async () => {
    const { controller, viewer, locks, frames, durations } = createHarness();
    await controller.initializeAnimations(viewer.src);
    viewer.log = [];

    const first = controller.playDisassemble();
    const duplicate = await controller.playDisassemble();
    const started = await first;

    expect(started).toBe(true);
    expect(duplicate).toBe(false);
    expect(controller.state).toBe('playing-disassemble');
    expect(viewer.log).toEqual([
      'pause',
      'animation:Disassemble',
      'updateComplete',
      'timeScale:1',
      'updateComplete',
      'play:1',
    ]);
    expect(locks.at(-1)).toBe(true);
    expect(frames.size).toBe(1);
    expect(durations).toEqual([{ animationName: 'Disassemble', duration: 10 }]);
  });

  it('暂停保留动画和时间，继续仍使用单次播放且不归零', async () => {
    const { controller, viewer, frames, cancelledFrames } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();
    viewer.currentTime = 4.8;
    viewer.log = [];

    expect(controller.pauseCurrentAnimation()).toBe(true);
    expect(controller.state).toBe('paused-disassemble');
    expect(viewer.animationName).toBe('Disassemble');
    expect(viewer.currentTime).toBe(4.8);
    expect(frames.size).toBe(0);
    expect(cancelledFrames.length).toBe(1);

    expect(controller.resumeCurrentAnimation()).toBe(true);
    expect(controller.state).toBe('playing-disassemble');
    expect(viewer.currentTime).toBe(4.8);
    expect(viewer.log).toEqual(['pause', 'timeScale:1', 'play:1']);
    expect(frames.size).toBe(1);
  });

  it('末帧 finished 尚未派发时点击暂停会直接完成，不会从头继续', async () => {
    const { controller, viewer } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();
    viewer.currentTime = viewer.duration;

    expect(controller.pauseCurrentAnimation()).toBe(true);

    expect(controller.state).toBe('disassembled');
    expect(viewer.currentTime).toBe(viewer.duration);
    expect(controller.resumeCurrentAnimation()).toBe(false);
  });

  it('finished 将进度钳制到 100%，停在末帧并解锁自动旋转', async () => {
    const { controller, viewer, progress, locks, frames } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();
    viewer.currentTime = viewer.duration;

    viewer.dispatchEvent(new Event('finished'));

    expect(controller.state).toBe('disassembled');
    expect(viewer.currentTime).toBe(10);
    expect(progress.at(-1)).toBe(100);
    expect(locks.at(-1)).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('运行时已在 duration 时不重复 setTime，避免 LoopOnce 绕回首帧', async () => {
    const { controller, viewer } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();
    viewer.currentTime = viewer.duration;
    const assignmentsAtTerminalFrame = viewer.currentTimeAssignments;

    viewer.dispatchEvent(new Event('finished'));

    expect(controller.state).toBe('disassembled');
    expect(viewer.currentTimeAssignments).toBe(assignmentsAtTerminalFrame);
  });

  it('动画中重置会使旧操作失效并回到组装首帧', async () => {
    const { controller, viewer, locks } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();
    viewer.currentTime = 2;

    const reset = await controller.resetToAssembled();
    viewer.currentTime = viewer.duration;
    viewer.dispatchEvent(new Event('finished'));

    expect(reset).toBe(true);
    expect(controller.state).toBe('assembled');
    expect(viewer.animationName).toBe('Disassemble');
    expect(locks.at(-1)).toBe(false);
  });

  it('duration 无效时暂停并进入 animation-error，不产生未处理播放', async () => {
    const { controller, viewer, errors, frames, locks } = createHarness();
    await controller.initializeAnimations(viewer.src);
    viewer.durationByName.Disassemble = 0;

    const started = await controller.playDisassemble();

    expect(started).toBe(false);
    expect(controller.state).toBe('animation-error');
    expect(errors).toHaveLength(1);
    expect(viewer.log.filter((entry) => entry === 'play:1')).toHaveLength(0);
    expect(frames.size).toBe(0);
    expect(locks.at(-1)).toBe(false);
  });

  it('requestAnimationFrame 使用真实 currentTime / duration 且始终只有一个循环', async () => {
    const { controller, viewer, progress, frames } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();
    viewer.currentTime = 3.6;
    const [frameId, callback] = [...frames.entries()][0];
    frames.delete(frameId);

    callback(16);

    expect(progress.at(-1)).toBe(36);
    expect(frames.size).toBe(1);
  });

  it('续播路径漏发 finished 时由真实末帧 RAF 安全收敛完成态', async () => {
    const { controller, viewer, frames, locks } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();
    viewer.currentTime = viewer.duration;
    const [frameId, callback] = [...frames.entries()][0];
    frames.delete(frameId);

    callback(16);

    expect(controller.state).toBe('disassembled');
    expect(locks.at(-1)).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('destroy 取消 RAF、令牌和唯一 finished 监听器', async () => {
    const { controller, viewer, frames } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();

    controller.destroy();

    expect(frames.size).toBe(0);
    expect(viewer.finishedListenerCount).toBe(0);
    viewer.currentTime = viewer.duration;
    viewer.dispatchEvent(new Event('finished'));
    expect(controller.state).toBe('playing-disassemble');
  });

  it('模型重新加载前取消旧进度、播放操作和自动旋转锁', async () => {
    const { controller, viewer, frames, locks } = createHarness();
    await controller.initializeAnimations(viewer.src);
    await controller.playDisassemble();

    controller.prepareForModelLoad();
    viewer.currentTime = viewer.duration;
    viewer.dispatchEvent(new Event('finished'));

    expect(controller.state).toBe('initializing');
    expect(frames.size).toBe(0);
    expect(locks.at(-1)).toBe(false);
  });
});
