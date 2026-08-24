import {
  ASSEMBLE_ANIMATION,
  clampAnimationProgress,
  completeAnimationInitialization,
  DISASSEMBLE_ANIMATION,
  finishAnimation,
  isValidAnimationDuration,
  pauseAnimation,
  resetAnimation,
  resumeAnimation,
  shouldAcceptFinished,
  startAnimation,
  type AnimationStateReason,
  type PuzzleAnimationName,
  type PuzzleAnimationState,
} from './animation-state';

export interface AnimationViewer extends EventTarget {
  readonly availableAnimations: readonly string[];
  animationName: string | undefined;
  readonly duration: number;
  currentTime: number;
  timeScale: number;
  readonly updateComplete: Promise<boolean>;
  readonly src: string;
  pause(): void;
  play(options: { repetitions: number }): void;
}

export interface AnimationControllerOptions {
  onStateChange?: (
    state: PuzzleAnimationState,
    reason: AnimationStateReason,
  ) => void;
  onProgress?: (progress: number) => void;
  onPlaybackLockChange?: (locked: boolean) => void;
  onAnimationReady?: (
    animationName: PuzzleAnimationName,
    duration: number,
  ) => void;
  onError?: (error: Error) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
}

export interface AnimationInitializationResult {
  status: 'ready' | 'unavailable' | 'stale' | 'error';
  availableAnimations: string[];
  missingAnimations: PuzzleAnimationName[];
}

interface ActivePlayback {
  generation: number;
  animationName: PuzzleAnimationName;
  modelId: string;
}

export class AnimationController {
  state: PuzzleAnimationState = 'initializing';

  private readonly viewer: AnimationViewer;
  private readonly options: AnimationControllerOptions;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private playbackGeneration = 0;
  private modelId = '';
  private activePlayback: ActivePlayback | undefined;
  private progressFrame: number | undefined;
  private playbackLocked = false;
  private destroyed = false;

  private readonly finishedHandler = (): void => {
    this.handleFinished();
  };

  constructor(viewer: AnimationViewer, options: AnimationControllerOptions = {}) {
    this.viewer = viewer;
    this.options = options;
    this.requestFrame =
      options.requestFrame ?? window.requestAnimationFrame.bind(window);
    this.cancelFrame = options.cancelFrame ?? window.cancelAnimationFrame.bind(window);
    this.viewer.addEventListener('finished', this.finishedHandler);
  }

  async initializeAnimations(
    modelId: string,
    availableAnimationsOverride?: readonly string[],
  ): Promise<AnimationInitializationResult> {
    const generation = this.beginModelOperation(modelId);
    const availableAnimations = [
      ...(availableAnimationsOverride ?? this.viewer.availableAnimations),
    ];
    const initialization = completeAnimationInitialization(availableAnimations);

    this.viewer.pause();

    if (!initialization.available) {
      this.setProgress(0);
      this.setState('unavailable', 'unavailable');
      return {
        status: 'unavailable',
        availableAnimations,
        missingAnimations: initialization.missing,
      };
    }

    try {
      this.viewer.animationName = DISASSEMBLE_ANIMATION;
      await this.viewer.updateComplete;
      if (!this.isOperationCurrent(generation, modelId)) {
        return this.staleResult(availableAnimations);
      }

      this.viewer.timeScale = 1;
      this.viewer.currentTime = 0;
      await this.viewer.updateComplete;
      if (!this.isOperationCurrent(generation, modelId)) {
        return this.staleResult(availableAnimations);
      }

      this.viewer.pause();
      this.setProgress(0);
      this.setState('assembled', 'initialized');

      return {
        status: 'ready',
        availableAnimations,
        missingAnimations: [],
      };
    } catch (error) {
      if (!this.isOperationCurrent(generation, modelId)) {
        return this.staleResult(availableAnimations);
      }
      this.failOperation(error);
      return {
        status: 'error',
        availableAnimations,
        missingAnimations: [],
      };
    }
  }

  playDisassemble(): Promise<boolean> {
    return this.playAnimation(DISASSEMBLE_ANIMATION);
  }

  playAssemble(): Promise<boolean> {
    return this.playAnimation(ASSEMBLE_ANIMATION);
  }

  pauseCurrentAnimation(): boolean {
    const nextState = pauseAnimation(this.state);
    if (nextState === this.state) {
      return false;
    }

    const duration = this.viewer.duration;
    if (
      isValidAnimationDuration(duration) &&
      Number.isFinite(this.viewer.currentTime) &&
      this.viewer.currentTime >= duration
    ) {
      this.handleFinished();
      return true;
    }

    this.viewer.pause();
    this.stopProgressLoop();
    this.updateProgressFromViewer();
    this.setState(nextState, 'paused');
    return true;
  }

  resumeCurrentAnimation(): boolean {
    const nextState = resumeAnimation(this.state);
    const active = this.activePlayback;
    if (nextState === this.state || active === undefined) {
      return false;
    }

    if (
      active.generation !== this.playbackGeneration ||
      active.modelId !== this.modelId ||
      this.viewer.src !== this.modelId ||
      this.viewer.animationName !== active.animationName ||
      !isValidAnimationDuration(this.viewer.duration)
    ) {
      this.failOperation(new Error('无法从当前进度继续拆装动画。'));
      return false;
    }

    try {
      this.viewer.timeScale = 1;
      this.viewer.play({ repetitions: 1 });
      this.setState(nextState, 'resumed');
      this.startProgressLoop();
      return true;
    } catch (error) {
      this.failOperation(error);
      return false;
    }
  }

  async resetToAssembled(): Promise<boolean> {
    if (this.state === 'unavailable' || this.destroyed) {
      return false;
    }

    const modelId = this.modelId || this.viewer.src;
    const generation = ++this.playbackGeneration;
    this.activePlayback = undefined;
    this.stopProgressLoop();
    this.viewer.pause();
    this.setState('initializing', 'initializing');

    try {
      this.viewer.animationName = DISASSEMBLE_ANIMATION;
      await this.viewer.updateComplete;
      if (!this.isOperationCurrent(generation, modelId)) {
        return false;
      }

      this.viewer.timeScale = 1;
      this.viewer.currentTime = 0;
      await this.viewer.updateComplete;
      if (!this.isOperationCurrent(generation, modelId)) {
        return false;
      }

      this.viewer.pause();
      this.setProgress(0);
      this.setState(resetAnimation('initializing'), 'reset');
      this.setPlaybackLock(false);
      return true;
    } catch (error) {
      if (this.isOperationCurrent(generation, modelId)) {
        this.failOperation(error);
      }
      return false;
    }
  }

  getAnimationProgress(): number {
    return clampAnimationProgress(this.viewer.currentTime, this.viewer.duration);
  }

  prepareForModelLoad(): void {
    if (this.destroyed) {
      return;
    }

    ++this.playbackGeneration;
    this.activePlayback = undefined;
    this.modelId = '';
    this.stopProgressLoop();
    this.viewer.pause();
    this.setProgress(0);
    this.setState('initializing', 'initializing');
    this.setPlaybackLock(false);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    ++this.playbackGeneration;
    this.activePlayback = undefined;
    this.stopProgressLoop();
    this.viewer.pause();
    this.setPlaybackLock(false);
    this.viewer.removeEventListener('finished', this.finishedHandler);
  }

  private async playAnimation(animationName: PuzzleAnimationName): Promise<boolean> {
    const nextState = startAnimation(this.state, animationName);
    if (nextState === this.state || this.destroyed || this.modelId === '') {
      return false;
    }

    const generation = ++this.playbackGeneration;
    const modelId = this.modelId;
    this.activePlayback = { generation, animationName, modelId };
    this.stopProgressLoop();
    this.setProgress(0);
    this.setPlaybackLock(true);
    this.setState(nextState, 'started');

    try {
      this.viewer.pause();
      this.viewer.animationName = animationName;
      await this.viewer.updateComplete;
      if (!this.isPlaybackCurrent(generation, animationName, modelId)) {
        return false;
      }

      this.viewer.timeScale = 1;
      this.viewer.currentTime = 0;
      await this.viewer.updateComplete;
      if (!this.isPlaybackCurrent(generation, animationName, modelId)) {
        return false;
      }

      if (!isValidAnimationDuration(this.viewer.duration)) {
        throw new Error(`动画 ${animationName} 的 duration 无效。`);
      }

      this.options.onAnimationReady?.(animationName, this.viewer.duration);
      this.viewer.play({ repetitions: 1 });
      this.startProgressLoop();
      return true;
    } catch (error) {
      if (this.isPlaybackCurrent(generation, animationName, modelId)) {
        this.failOperation(error);
      }
      return false;
    }
  }

  private handleFinished(): boolean {
    const active = this.activePlayback;
    if (active === undefined || this.destroyed) {
      return false;
    }

    const duration = this.viewer.duration;
    if (
      !shouldAcceptFinished({
        activeGeneration: active.generation,
        currentGeneration: this.playbackGeneration,
        state: this.state,
        expectedAnimationName: active.animationName,
        currentAnimationName: this.viewer.animationName,
        activeModelId: active.modelId,
        currentModelId: this.viewer.src,
        currentTime: this.viewer.currentTime,
        duration,
      })
    ) {
      return false;
    }

    this.stopProgressLoop();
    this.viewer.pause();
    const clampedTime = Math.min(duration, Math.max(0, this.viewer.currentTime));
    if (clampedTime !== this.viewer.currentTime) {
      this.viewer.currentTime = clampedTime;
    }
    this.setProgress(100);
    const completedState = finishAnimation(this.state);
    this.activePlayback = undefined;
    this.setState(completedState, 'finished');
    this.setPlaybackLock(false);
    return true;
  }

  private beginModelOperation(modelId: string): number {
    const generation = ++this.playbackGeneration;
    this.modelId = modelId;
    this.activePlayback = undefined;
    this.stopProgressLoop();
    this.setPlaybackLock(false);
    this.setProgress(0);
    this.setState('initializing', 'initializing');
    return generation;
  }

  private isOperationCurrent(generation: number, modelId: string): boolean {
    return (
      !this.destroyed &&
      generation === this.playbackGeneration &&
      modelId === this.modelId &&
      this.viewer.src === modelId
    );
  }

  private isPlaybackCurrent(
    generation: number,
    animationName: PuzzleAnimationName,
    modelId: string,
  ): boolean {
    const active = this.activePlayback;
    return (
      this.isOperationCurrent(generation, modelId) &&
      active?.generation === generation &&
      active.animationName === animationName &&
      active.modelId === modelId
    );
  }

  private staleResult(availableAnimations: string[]): AnimationInitializationResult {
    return {
      status: 'stale',
      availableAnimations,
      missingAnimations: [],
    };
  }

  private failOperation(error: unknown): void {
    const safeError = error instanceof Error ? error : new Error(String(error));
    ++this.playbackGeneration;
    this.activePlayback = undefined;
    this.stopProgressLoop();
    this.viewer.pause();
    this.setState('animation-error', 'error');
    this.setPlaybackLock(false);
    this.options.onError?.(safeError);
  }

  private updateProgressFromViewer(): void {
    this.setProgress(this.getAnimationProgress());
  }

  private startProgressLoop(): void {
    this.stopProgressLoop();
    const tick: FrameRequestCallback = () => {
      this.progressFrame = undefined;
      if (
        this.state !== 'playing-disassemble' &&
        this.state !== 'playing-assemble'
      ) {
        return;
      }

      this.updateProgressFromViewer();
      if (
        isValidAnimationDuration(this.viewer.duration) &&
        this.viewer.currentTime >= this.viewer.duration &&
        this.handleFinished()
      ) {
        return;
      }
      this.progressFrame = this.requestFrame(tick);
    };
    this.progressFrame = this.requestFrame(tick);
  }

  private stopProgressLoop(): void {
    if (this.progressFrame === undefined) {
      return;
    }

    this.cancelFrame(this.progressFrame);
    this.progressFrame = undefined;
  }

  private setProgress(progress: number): void {
    const safeProgress = Math.min(100, Math.max(0, Math.round(progress)));
    this.options.onProgress?.(safeProgress);
  }

  private setState(state: PuzzleAnimationState, reason: AnimationStateReason): void {
    this.state = state;
    this.options.onStateChange?.(state, reason);
  }

  private setPlaybackLock(locked: boolean): void {
    if (this.playbackLocked === locked) {
      return;
    }

    this.playbackLocked = locked;
    this.options.onPlaybackLockChange?.(locked);
  }
}
