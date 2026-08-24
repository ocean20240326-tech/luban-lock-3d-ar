import { ANIMATED_MODEL_PATH, AR_MODEL_PATH } from './model-config';

export type AppMode = 'viewer' | 'ar';

export interface ModeConfig {
  modelPath: string;
  initializeAnimations: boolean;
  enableAr: boolean;
  autoRotate: boolean;
}

export interface PageCopy {
  title: string;
  subtitle: string;
  regionLabel: string;
}

const AR_TEST_PARAMETERS = [
  'simulate-ar-missing',
  'simulate-ar-unsupported',
  'simulate-insecure-context',
] as const;

export function getAppMode(searchParams: URLSearchParams): AppMode {
  return searchParams.get('mode') === 'ar' ? 'ar' : 'viewer';
}

export function getModeConfig(mode: AppMode): ModeConfig {
  if (mode === 'ar') {
    return {
      modelPath: AR_MODEL_PATH,
      initializeAnimations: false,
      enableAr: true,
      autoRotate: false,
    };
  }

  return {
    modelPath: ANIMATED_MODEL_PATH,
    initializeAnimations: true,
    enableAr: false,
    autoRotate: true,
  };
}

export function shouldInitializeAnimationController(mode: AppMode): boolean {
  return mode === 'viewer';
}

export function shouldDestroyOnPageHide(persisted: boolean): boolean {
  return !persisted;
}

export function getPageCopy(mode: AppMode): PageCopy {
  return mode === 'ar'
    ? {
        title: '六通鲁班锁 AR 查看',
        subtitle: '将约7.5厘米的鲁班锁放到现实桌面中',
        regionLabel: '六通鲁班锁AR预览模式',
      }
    : {
        title: '六通鲁班锁',
        subtitle: '用手指旋转、缩放查看模型',
        regionLabel: '鲁班锁3D展示区域',
      };
}

export function getMissingModelMessage(mode: AppMode): string {
  return mode === 'ar'
    ? '未找到AR模型，请运行 npm run model:ar。'
    : '未找到模型文件，请将模型放入 public/models/luban-lock.glb';
}

function relativeUrl(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query === '' ? pathname : `${pathname}?${query}`;
}

export function getArUrl(
  searchParams: URLSearchParams,
  pathname = '/',
): string {
  const next = new URLSearchParams(searchParams);
  next.delete('simulate-missing-animation');
  for (const parameter of AR_TEST_PARAMETERS) {
    next.delete(parameter);
  }
  next.set('mode', 'ar');
  return relativeUrl(pathname, next);
}

export function getViewerUrl(
  searchParams: URLSearchParams,
  pathname = '/',
): string {
  const next = new URLSearchParams(searchParams);
  next.delete('mode');
  for (const parameter of AR_TEST_PARAMETERS) {
    next.delete(parameter);
  }
  return relativeUrl(pathname, next);
}
