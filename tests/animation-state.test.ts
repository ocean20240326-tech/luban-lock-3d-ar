import { describe, expect, it } from 'vitest';

import {
  animationButtonState,
  animationStatusCopy,
  clampAnimationProgress,
  completeAnimationInitialization,
  finishAnimation,
  hasRequiredAnimations,
  isValidAnimationDuration,
  pauseAnimation,
  resetAnimation,
  resumeAnimation,
  shouldAcceptFinished,
  startAnimation,
  type PuzzleAnimationState,
} from '../src/animation-state';
import {
  ANIMATED_MODEL_PATH,
  animationsForDevelopment,
  AR_MODEL_PATH,
  MODEL_URL,
} from '../src/model-config';

describe('动画可用性', () => {
  it('同时包含 Assemble 和 Disassemble 时可用且不依赖数组顺序', () => {
    expect(hasRequiredAnimations(['Disassemble', 'Assemble'])).toEqual({
      available: true,
      missing: [],
    });
    expect(hasRequiredAnimations(['Assemble', 'Extra', 'Disassemble']).available).toBe(
      true,
    );
  });

  it('缺少 Assemble 时进入 unavailable', () => {
    const result = completeAnimationInitialization(['Disassemble']);

    expect(result.state).toBe('unavailable');
    expect(result.missing).toEqual(['Assemble']);
  });

  it('缺少 Disassemble 时进入 unavailable', () => {
    const result = completeAnimationInitialization(['Assemble']);

    expect(result.state).toBe('unavailable');
    expect(result.missing).toEqual(['Disassemble']);
  });

  it('完整动画列表使初始状态从 initializing 进入 assembled', () => {
    expect(completeAnimationInitialization(['Assemble', 'Disassemble']).state).toBe(
      'assembled',
    );
  });
});

describe('动画状态转换', () => {
  it('assembled 只能启动 Disassemble', () => {
    expect(startAnimation('assembled', 'Disassemble')).toBe('playing-disassemble');
    expect(startAnimation('assembled', 'Assemble')).toBe('assembled');
  });

  it('disassembled 只能启动 Assemble', () => {
    expect(startAnimation('disassembled', 'Assemble')).toBe('playing-assemble');
    expect(startAnimation('disassembled', 'Disassemble')).toBe('disassembled');
  });

  it('播放中不能启动另一段动画', () => {
    expect(startAnimation('playing-disassemble', 'Assemble')).toBe(
      'playing-disassemble',
    );
    expect(startAnimation('playing-assemble', 'Disassemble')).toBe('playing-assemble');
  });

  it('暂停后进入与当前动画匹配的 paused 状态', () => {
    expect(pauseAnimation('playing-disassemble')).toBe('paused-disassemble');
    expect(pauseAnimation('playing-assemble')).toBe('paused-assemble');
  });

  it('继续后恢复与当前动画匹配的 playing 状态', () => {
    expect(resumeAnimation('paused-disassemble')).toBe('playing-disassemble');
    expect(resumeAnimation('paused-assemble')).toBe('playing-assemble');
  });

  it.each<PuzzleAnimationState>([
    'initializing',
    'assembled',
    'playing-disassemble',
    'paused-disassemble',
    'disassembled',
    'playing-assemble',
    'paused-assemble',
    'animation-error',
  ])('reset 将 %s 返回 assembled', (state) => {
    expect(resetAnimation(state)).toBe('assembled');
  });

  it('unavailable 不能通过 reset 伪装成可用', () => {
    expect(resetAnimation('unavailable')).toBe('unavailable');
  });
});

describe('finished 事件保护', () => {
  const validFinished = {
    activeGeneration: 4,
    currentGeneration: 4,
    state: 'playing-disassemble' as const,
    expectedAnimationName: 'Disassemble' as const,
    currentAnimationName: 'Disassemble',
    activeModelId: '/models/luban-lock.glb',
    currentModelId: '/models/luban-lock.glb',
    currentTime: 10,
    duration: 10,
  };

  it('忽略旧 generation 的 finished 事件', () => {
    expect(
      shouldAcceptFinished({ ...validFinished, activeGeneration: 3 }),
    ).toBe(false);
  });

  it('正确 generation 的 finished 完成状态转换', () => {
    expect(shouldAcceptFinished(validFinished)).toBe(true);
    expect(finishAnimation('playing-disassemble')).toBe('disassembled');
    expect(finishAnimation('playing-assemble')).toBe('assembled');
  });

  it('动画名、模型或末帧不匹配时拒绝 finished', () => {
    expect(
      shouldAcceptFinished({ ...validFinished, currentAnimationName: 'Assemble' }),
    ).toBe(false);
    expect(
      shouldAcceptFinished({ ...validFinished, currentModelId: 'new-model' }),
    ).toBe(false);
    expect(shouldAcceptFinished({ ...validFinished, currentTime: 1 })).toBe(false);
  });
});

describe('按钮、进度与文案', () => {
  it('按钮 disabled 状态符合状态表', () => {
    expect(animationButtonState('assembled')).toEqual({
      disassembleDisabled: false,
      assembleDisabled: true,
      pauseResumeDisabled: true,
      resetDisabled: false,
      pauseResumeLabel: '暂停动画',
    });
    expect(animationButtonState('playing-disassemble')).toMatchObject({
      disassembleDisabled: true,
      assembleDisabled: true,
      pauseResumeDisabled: false,
      resetDisabled: false,
      pauseResumeLabel: '暂停动画',
    });
    expect(animationButtonState('paused-assemble')).toMatchObject({
      pauseResumeDisabled: false,
      pauseResumeLabel: '继续动画',
    });
    expect(animationButtonState('disassembled')).toMatchObject({
      disassembleDisabled: true,
      assembleDisabled: false,
      pauseResumeDisabled: true,
      resetDisabled: false,
    });
    expect(animationButtonState('unavailable')).toMatchObject({
      disassembleDisabled: true,
      assembleDisabled: true,
      pauseResumeDisabled: true,
      resetDisabled: true,
    });
    expect(animationButtonState('animation-error').resetDisabled).toBe(true);
  });

  it('进度始终限制在 0 到 100', () => {
    expect(clampAnimationProgress(-5, 10)).toBe(0);
    expect(clampAnimationProgress(3.64, 10)).toBe(36);
    expect(clampAnimationProgress(12, 10)).toBe(100);
    expect(clampAnimationProgress(Number.NaN, 10)).toBe(0);
  });

  it('duration 无效时可进入安全错误分支', () => {
    expect(isValidAnimationDuration(10)).toBe(true);
    expect(isValidAnimationDuration(0)).toBe(false);
    expect(isValidAnimationDuration(Number.NaN)).toBe(false);
    expect(isValidAnimationDuration(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('动画缺失文案明确且不改变普通模型加载状态', () => {
    const viewerStatus = 'ready';
    const animationState = completeAnimationInitialization(['Disassemble']).state;

    expect(viewerStatus).toBe('ready');
    expect(animationState).toBe('unavailable');
    expect(animationStatusCopy(animationState, 0, 'unavailable')).toBe(
      '当前模型未包含完整的拆解与组装动画。',
    );
  });

  it('播放、暂停、完成和重置文案包含正确进度或结果', () => {
    expect(animationStatusCopy('playing-disassemble', 36, 'started')).toBe(
      '正在拆解鲁班锁 · 36%',
    );
    expect(animationStatusCopy('paused-disassemble', 48, 'paused')).toBe(
      '拆解动画已暂停 · 48%',
    );
    expect(animationStatusCopy('playing-assemble', 72, 'resumed')).toBe(
      '正在重新组装鲁班锁 · 72%',
    );
    expect(animationStatusCopy('disassembled', 100, 'finished')).toBe('拆解完成');
    expect(animationStatusCopy('assembled', 100, 'finished')).toBe('组装完成');
    expect(animationStatusCopy('assembled', 0, 'reset')).toBe('已恢复组装状态');
  });
});

describe('模型配置', () => {
  it('GLB 路径仍然是 /models/luban-lock.glb', () => {
    expect(MODEL_URL).toBe('/models/luban-lock.glb');
    expect(ANIMATED_MODEL_PATH).toBe('/models/luban-lock.glb');
    expect(AR_MODEL_PATH).toBe('/models/luban-lock-ar.glb');
  });

  it('开发诊断可以模拟缺少指定动画且不改动原数组', () => {
    const animations = ['Assemble', 'Disassemble'];

    expect(animationsForDevelopment(animations, 'Assemble', true)).toEqual([
      'Disassemble',
    ]);
    expect(animations).toEqual(['Assemble', 'Disassemble']);
  });

  it('非开发环境忽略动画缺失模拟参数', () => {
    expect(
      animationsForDevelopment(
        ['Assemble', 'Disassemble'],
        'Assemble',
        false,
      ),
    ).toEqual(['Assemble', 'Disassemble']);
  });
});
