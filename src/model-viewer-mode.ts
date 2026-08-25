import type { AppMode } from './app-mode';
import { AR_MODEL_POSTER_PATH } from './model-config';

export interface AttributeTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  toggleAttribute(name: string, force?: boolean): boolean;
}

const AR_ATTRIBUTES = ['ar', 'ar-modes', 'ar-scale', 'ar-placement'] as const;
const FORBIDDEN_AR_MODEL_ATTRIBUTES = [
  'autoplay',
  'animation-name',
  'time-scale',
  'ios-src',
  'scale',
] as const;

export function configureModelViewerForMode(
  viewer: AttributeTarget,
  mode: AppMode,
): void {
  for (const attribute of FORBIDDEN_AR_MODEL_ATTRIBUTES) {
    viewer.removeAttribute(attribute);
  }

  if (mode === 'ar') {
    viewer.toggleAttribute('ar', true);
    viewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    viewer.setAttribute('ar-scale', 'fixed');
    viewer.setAttribute('ar-placement', 'floor');
    viewer.setAttribute('alt', '六通鲁班锁AR模型');
    viewer.setAttribute('poster', AR_MODEL_POSTER_PATH);
    viewer.removeAttribute('auto-rotate');
    return;
  }

  for (const attribute of AR_ATTRIBUTES) {
    viewer.removeAttribute(attribute);
  }
  viewer.removeAttribute('poster');
  viewer.setAttribute('alt', '六通鲁班锁3D模型');
}
