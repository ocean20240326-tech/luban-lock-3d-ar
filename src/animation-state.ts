export const ASSEMBLE_ANIMATION = 'Assemble' as const;
export const DISASSEMBLE_ANIMATION = 'Disassemble' as const;

export type PuzzleAnimationName =
  | typeof ASSEMBLE_ANIMATION
  | typeof DISASSEMBLE_ANIMATION;

export type PuzzleAnimationState =
  | 'unavailable'
  | 'initializing'
  | 'assembled'
  | 'playing-disassemble'
  | 'paused-disassemble'
  | 'disassembled'
  | 'playing-assemble'
  | 'paused-assemble'
  | 'animation-error';

export type AnimationStateReason =
  | 'initializing'
  | 'initialized'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'finished'
  | 'reset'
  | 'unavailable'
  | 'error';

export interface AnimationAvailability {
  available: boolean;
  missing: PuzzleAnimationName[];
}

export interface AnimationInitialization extends AnimationAvailability {
  state: PuzzleAnimationState;
}

export interface AnimationButtonState {
  disassembleDisabled: boolean;
  assembleDisabled: boolean;
  pauseResumeDisabled: boolean;
  resetDisabled: boolean;
  pauseResumeLabel: '暂停动画' | '继续动画';
}

export interface FinishedValidation {
  activeGeneration: number;
  currentGeneration: number;
  state: PuzzleAnimationState;
  expectedAnimationName: PuzzleAnimationName;
  currentAnimationName: string | undefined;
  activeModelId: string;
  currentModelId: string;
  currentTime: number;
  duration: number;
}

const REQUIRED_ANIMATIONS: readonly PuzzleAnimationName[] = [
  ASSEMBLE_ANIMATION,
  DISASSEMBLE_ANIMATION,
];

export function hasRequiredAnimations(
  availableAnimations: readonly string[],
): AnimationAvailability {
  const available = new Set(availableAnimations);
  const missing = REQUIRED_ANIMATIONS.filter((name) => !available.has(name));

  return { available: missing.length === 0, missing };
}

export function completeAnimationInitialization(
  availableAnimations: readonly string[],
): AnimationInitialization {
  const result = hasRequiredAnimations(availableAnimations);
  return {
    ...result,
    state: result.available ? 'assembled' : 'unavailable',
  };
}

export function startAnimation(
  state: PuzzleAnimationState,
  animationName: PuzzleAnimationName,
): PuzzleAnimationState {
  if (state === 'assembled' && animationName === DISASSEMBLE_ANIMATION) {
    return 'playing-disassemble';
  }
  if (state === 'disassembled' && animationName === ASSEMBLE_ANIMATION) {
    return 'playing-assemble';
  }
  return state;
}

export function pauseAnimation(state: PuzzleAnimationState): PuzzleAnimationState {
  if (state === 'playing-disassemble') {
    return 'paused-disassemble';
  }
  if (state === 'playing-assemble') {
    return 'paused-assemble';
  }
  return state;
}

export function resumeAnimation(state: PuzzleAnimationState): PuzzleAnimationState {
  if (state === 'paused-disassemble') {
    return 'playing-disassemble';
  }
  if (state === 'paused-assemble') {
    return 'playing-assemble';
  }
  return state;
}

export function finishAnimation(state: PuzzleAnimationState): PuzzleAnimationState {
  if (state === 'playing-disassemble') {
    return 'disassembled';
  }
  if (state === 'playing-assemble') {
    return 'assembled';
  }
  return state;
}

export function resetAnimation(state: PuzzleAnimationState): PuzzleAnimationState {
  return state === 'unavailable' ? state : 'assembled';
}

export function isValidAnimationDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

export function clampAnimationProgress(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !isValidAnimationDuration(duration)) {
    return 0;
  }

  return Math.round(Math.min(1, Math.max(0, currentTime / duration)) * 100);
}

export function shouldAcceptFinished(context: FinishedValidation): boolean {
  const isPlaying =
    context.state === 'playing-disassemble' || context.state === 'playing-assemble';
  const endTolerance = Math.max(0.05, context.duration * 0.01);

  return (
    context.activeGeneration === context.currentGeneration &&
    isPlaying &&
    context.currentAnimationName === context.expectedAnimationName &&
    context.activeModelId === context.currentModelId &&
    isValidAnimationDuration(context.duration) &&
    Number.isFinite(context.currentTime) &&
    context.currentTime >= context.duration - endTolerance
  );
}

export function animationButtonState(
  state: PuzzleAnimationState,
): AnimationButtonState {
  const paused = state === 'paused-disassemble' || state === 'paused-assemble';
  const playing = state === 'playing-disassemble' || state === 'playing-assemble';
  const controlsUnavailable =
    state === 'unavailable' ||
    state === 'initializing' ||
    state === 'animation-error';

  return {
    disassembleDisabled: state !== 'assembled',
    assembleDisabled: state !== 'disassembled',
    pauseResumeDisabled: !(playing || paused),
    resetDisabled: controlsUnavailable,
    pauseResumeLabel: paused ? '继续动画' : '暂停动画',
  };
}

export function animationStatusCopy(
  state: PuzzleAnimationState,
  progress: number,
  reason: AnimationStateReason,
): string {
  const percentage = Math.min(100, Math.max(0, Math.round(progress)));

  if (state === 'unavailable') {
    return '当前模型未包含完整的拆解与组装动画。';
  }
  if (state === 'animation-error') {
    return '拆装动画暂时无法使用，普通3D查看仍可继续。';
  }
  if (state === 'initializing') {
    return '正在初始化拆装动画……';
  }
  if (state === 'playing-disassemble') {
    return `正在拆解鲁班锁 · ${percentage}%`;
  }
  if (state === 'paused-disassemble') {
    return `拆解动画已暂停 · ${percentage}%`;
  }
  if (state === 'playing-assemble') {
    return `正在重新组装鲁班锁 · ${percentage}%`;
  }
  if (state === 'paused-assemble') {
    return `组装动画已暂停 · ${percentage}%`;
  }
  if (state === 'disassembled') {
    return '拆解完成';
  }
  if (reason === 'finished') {
    return '组装完成';
  }
  if (reason === 'reset') {
    return '已恢复组装状态';
  }
  return '鲁班锁已组装，可开始拆解演示';
}
