export const ANIMATED_MODEL_PATH = '/models/luban-lock.glb';
export const AR_MODEL_PATH = '/models/luban-lock-ar.glb';
export const AR_MODEL_POSTER_PATH = '/images/luban-lock-ar-poster.jpg';

// 保留旧名称，避免动画模块和既有测试的公共契约发生无关变化。
export const MODEL_URL = ANIMATED_MODEL_PATH;

export function animationsForDevelopment(
  availableAnimations: readonly string[],
  simulatedMissingAnimation: string | null,
  developmentMode: boolean,
): string[] {
  const animations = [...availableAnimations];
  if (!developmentMode || simulatedMissingAnimation === null) {
    return animations;
  }

  return animations.filter((name) => name !== simulatedMissingAnimation);
}
