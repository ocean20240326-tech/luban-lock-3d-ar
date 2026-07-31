export type ViewerStatus =
  | 'checking'
  | 'loading'
  | 'ready'
  | 'missing'
  | 'error';

export function clampProgress(totalProgress: number): number {
  return Math.round(Math.min(1, Math.max(0, totalProgress)) * 100);
}

export function initialAutoRotate(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion;
}

export function statusCopy(status: ViewerStatus): string {
  const copy: Record<ViewerStatus, string> = {
    checking: '正在检查3D模型……',
    loading: '正在加载3D模型……',
    ready: '3D模型已加载',
    missing: '未找到模型文件，请将模型放入 public/models/luban-lock.glb',
    error: '3D模型加载失败，请检查网络后重试。',
  };

  return copy[status];
}
