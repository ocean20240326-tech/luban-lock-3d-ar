export type ArState =
  | 'inactive'
  | 'checking'
  | 'ready'
  | 'unsupported'
  | 'insecure-context'
  | 'launching'
  | 'session-started'
  | 'object-placed'
  | 'failed'
  | 'returned';

export type ModelViewerArStatus =
  | 'not-presenting'
  | 'session-started'
  | 'object-placed'
  | 'failed';

export interface ArSupportContext {
  modelLoaded: boolean;
  isSecureContext: boolean;
  canActivateAR: boolean;
}

export interface ArButtonState {
  disabled: boolean;
  label: string;
}

const AR_STATUS_VALUES: readonly ModelViewerArStatus[] = [
  'not-presenting',
  'session-started',
  'object-placed',
  'failed',
];

export function resolveArSupport(context: ArSupportContext): ArState {
  if (!context.modelLoaded) {
    return 'checking';
  }
  if (!context.isSecureContext) {
    return 'insecure-context';
  }
  return context.canActivateAR ? 'ready' : 'unsupported';
}

export function canOfferAr(state: ArState): boolean {
  return state === 'ready' || state === 'failed' || state === 'returned';
}

export function getArButtonState(state: ArState): ArButtonState {
  return {
    disabled: !canOfferAr(state),
    label: state === 'launching' ? '正在启动AR……' : '放到现实中',
  };
}

export function shouldShowUnavailableArButton(
  state: ArState,
  modelHasAnimations: boolean,
): boolean {
  return (
    modelHasAnimations ||
    state === 'unsupported' ||
    state === 'insecure-context' ||
    state === 'failed'
  );
}

export function getArStatusMessage(state: ArState): string {
  const messages: Record<ArState, string> = {
    inactive: 'AR模式未启用',
    checking: '正在检查AR支持……',
    ready: '当前设备支持AR查看',
    unsupported: '当前设备或浏览器暂不支持直接AR查看',
    'insecure-context': 'AR需要通过HTTPS网页运行',
    launching: '正在启动AR……',
    'session-started': '请缓慢移动手机寻找水平平面',
    'object-placed': '鲁班锁已放置',
    failed: 'AR启动失败，可继续使用普通3D查看',
    returned: '已返回网页，可再次启动AR',
  };
  return messages[state];
}

export function isArStatusEventDetail(
  detail: unknown,
): detail is { status: ModelViewerArStatus } {
  if (typeof detail !== 'object' || detail === null || !('status' in detail)) {
    return false;
  }
  const status = (detail as { status?: unknown }).status;
  return (
    typeof status === 'string' &&
    AR_STATUS_VALUES.includes(status as ModelViewerArStatus)
  );
}

export function mapArStatus(
  currentState: ArState,
  status: ModelViewerArStatus,
  hasLaunched: boolean,
): ArState {
  if (status === 'session-started') {
    return 'session-started';
  }
  if (status === 'object-placed') {
    return 'object-placed';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return hasLaunched ? 'returned' : currentState;
}
