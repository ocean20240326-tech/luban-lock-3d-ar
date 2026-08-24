import '@google/model-viewer';
import type { ModelViewerElement } from '@google/model-viewer';

import {
  AnimationController,
  type AnimationViewer,
} from './animation-controller';
import {
  animationButtonState,
  animationStatusCopy,
  type AnimationStateReason,
  type PuzzleAnimationState,
} from './animation-state';
import {
  getAppMode,
  getArUrl,
  getMissingModelMessage,
  getModeConfig,
  getPageCopy,
  getViewerUrl,
  shouldDestroyOnPageHide,
  shouldInitializeAnimationController,
} from './app-mode';
import { ArController, type ArViewer } from './ar-controller';
import {
  getArButtonState,
  getArStatusMessage,
  shouldShowUnavailableArButton,
  type ArState,
} from './ar-state';
import { checkModelAvailability } from './model-availability';
import { configureModelViewerForMode } from './model-viewer-mode';
import { animationsForDevelopment } from './model-config';
import './style.css';
import {
  clampProgress,
  initialAutoRotate,
  statusCopy,
  type ViewerStatus,
} from './viewer-state';

const INITIAL_CAMERA_ORBIT = '35deg 68deg 115%';
const INITIAL_FIELD_OF_VIEW = '30deg';
const READY_TRANSITION_MS = 320;

interface ProgressDetail {
  totalProgress: number;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`页面缺少必要元素：${selector}`);
  }
  return element;
}

const searchParams = new URLSearchParams(window.location.search);
const appMode = getAppMode(searchParams);
const modeConfig = getModeConfig(appMode);
const modelPath = modeConfig.modelPath;
const pageCopy = getPageCopy(appMode);

const viewer = requireElement<ModelViewerElement>('#lubanViewer');
const viewerCard = requireElement<HTMLElement>('#viewerCard');
const viewerFrame = requireElement<HTMLElement>('#viewerFrame');
const loadingPanel = requireElement<HTMLElement>('#loadingPanel');
const progressBar = requireElement<HTMLElement>('#progressBar');
const progressFill = requireElement<HTMLElement>('#progressFill');
const progressText = requireElement<HTMLElement>('#progressText');
const statusMessage = requireElement<HTMLElement>('#statusMessage');
const errorPanel = requireElement<HTMLElement>('#errorPanel');
const errorMessage = requireElement<HTMLElement>('#errorMessage');
const retryButton = requireElement<HTMLButtonElement>('#retryButton');
const returnViewerErrorButton = requireElement<HTMLButtonElement>(
  '#returnViewerErrorButton',
);
const controls = requireElement<HTMLElement>('#controls');
const viewerControls = requireElement<HTMLElement>('#viewerControls');
const viewerArEntry = requireElement<HTMLElement>('#viewerArEntry');
const rotationButton = requireElement<HTMLButtonElement>('#rotationButton');
const rotationButtonText = requireElement<HTMLElement>('#rotationButtonText');
const resetViewButton = requireElement<HTMLButtonElement>('#resetViewButton');
const enterArButton = requireElement<HTMLButtonElement>('#enterArButton');
const animationPanel = requireElement<HTMLElement>('#animationPanel');
const animationStatus = requireElement<HTMLElement>('#animationStatus');
const animationProgressBar = requireElement<HTMLElement>(
  '#animationProgressBar',
);
const animationProgressFill = requireElement<HTMLElement>(
  '#animationProgressFill',
);
const animationProgressText = requireElement<HTMLOutputElement>(
  '#animationProgressText',
);
const disassembleButton = requireElement<HTMLButtonElement>('#disassembleButton');
const assembleButton = requireElement<HTMLButtonElement>('#assembleButton');
const pauseResumeButton = requireElement<HTMLButtonElement>('#pauseResumeButton');
const resetModelButton = requireElement<HTMLButtonElement>('#resetModelButton');
const activateArButton = requireElement<HTMLButtonElement>('#activateArButton');
const unavailableArButton = requireElement<HTMLButtonElement>(
  '#unavailableArButton',
);
const arPanel = requireElement<HTMLElement>('#arPanel');
const arStatus = requireElement<HTMLElement>('#arStatus');
const arTrackingWarning = requireElement<HTMLElement>('#arTrackingWarning');
const arDeviceAdvice = requireElement<HTMLElement>('#arDeviceAdvice');
const returnViewerButton = requireElement<HTMLButtonElement>('#returnViewerButton');
const siteTitle = requireElement<HTMLElement>('#siteTitle');
const siteSubtitle = requireElement<HTMLElement>('#siteSubtitle');

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let status: ViewerStatus = 'checking';
let progress = 0;
let retryCount = 0;
let readyTimer: number | undefined;
let autoRotating =
  modeConfig.autoRotate && initialAutoRotate(reducedMotionQuery.matches);
let animationState: PuzzleAnimationState = 'initializing';
let animationReason: AnimationStateReason = 'initializing';
let animationProgress = 0;
let rotationLockedForAnimation = false;
let savedAutoRotatePreference: boolean | undefined;
let arState: ArState = appMode === 'ar' ? 'checking' : 'inactive';
let arModelHasAnimations = false;

let animationController: AnimationController | undefined;
let arController: ArController | undefined;

function setProgress(nextProgress: number): void {
  progress = clampProgress(nextProgress);
  progressText.textContent = `${progress}%`;
  progressBar.setAttribute('aria-valuenow', String(progress));
  progressFill.style.setProperty('--load-progress', `${progress}%`);
}

function syncRotationControl(): void {
  if (appMode === 'ar') {
    viewer.removeAttribute('auto-rotate');
    rotationButton.disabled = true;
    return;
  }

  viewer.toggleAttribute('auto-rotate', autoRotating);
  rotationButton.disabled = rotationLockedForAnimation;
  rotationButton.setAttribute('aria-pressed', String(autoRotating));
  rotationButton.setAttribute(
    'aria-label',
    autoRotating ? '暂停模型自动旋转' : '开启模型自动旋转',
  );
  rotationButtonText.textContent = autoRotating ? '暂停旋转' : '自动旋转';
  const icon = rotationButton.querySelector<HTMLElement>('.button-icon');
  if (icon) {
    icon.textContent = autoRotating ? 'Ⅱ' : '↻';
  }
}

function renderAnimationControls(): void {
  const buttons = animationButtonState(animationState);
  const message = animationStatusCopy(
    animationState,
    animationProgress,
    animationReason,
  );

  animationPanel.dataset.animationState = animationState;
  animationStatus.textContent = message;
  animationStatus.setAttribute(
    'role',
    animationState === 'animation-error' ? 'alert' : 'status',
  );
  animationProgressBar.setAttribute('aria-valuenow', String(animationProgress));
  animationProgressFill.style.setProperty(
    '--animation-progress',
    `${animationProgress}%`,
  );
  animationProgressText.value = `${animationProgress}%`;

  disassembleButton.disabled = buttons.disassembleDisabled;
  assembleButton.disabled = buttons.assembleDisabled;
  pauseResumeButton.disabled = buttons.pauseResumeDisabled;
  resetModelButton.disabled = buttons.resetDisabled;
  pauseResumeButton.textContent = buttons.pauseResumeLabel;
  pauseResumeButton.setAttribute(
    'aria-label',
    buttons.pauseResumeLabel === '继续动画' ? '继续拆装动画' : '暂停拆装动画',
  );
}

function coordinateAutoRotateWithAnimation(locked: boolean): void {
  if (locked && !rotationLockedForAnimation) {
    savedAutoRotatePreference = autoRotating;
    autoRotating = false;
    rotationLockedForAnimation = true;
    syncRotationControl();
    return;
  }

  if (!locked && rotationLockedForAnimation) {
    rotationLockedForAnimation = false;
    autoRotating = savedAutoRotatePreference ?? autoRotating;
    savedAutoRotatePreference = undefined;
    syncRotationControl();
  }
}

function renderArControls(): void {
  const button = getArButtonState(arState);
  activateArButton.disabled = button.disabled || arModelHasAnimations;
  activateArButton.textContent = button.label;
  unavailableArButton.hidden = !shouldShowUnavailableArButton(
    arState,
    arModelHasAnimations,
  );
  unavailableArButton.disabled = button.disabled || arModelHasAnimations;
  unavailableArButton.textContent = button.label;
  unavailableArButton.setAttribute(
    'aria-label',
    arState === 'failed'
      ? '再次尝试将鲁班锁放到现实中'
      : '当前设备暂不支持将鲁班锁放到现实中',
  );
  arPanel.dataset.arState = arState;
  arStatus.textContent = arModelHasAnimations
    ? 'AR静态模型仍包含动画，请重新运行 npm run model:ar。'
    : getArStatusMessage(arState);
  arStatus.setAttribute(
    'role',
    arModelHasAnimations || arState === 'failed' ? 'alert' : 'status',
  );
  if (arState !== 'session-started' && arState !== 'object-placed') {
    arTrackingWarning.hidden = true;
  }
}

function deviceAdvice(): string {
  const userAgent = navigator.userAgent;
  const advice: string[] = [];
  if (/MicroMessenger/iu.test(userAgent)) {
    advice.push('微信中如无法启动，请点击右上角并选择“在浏览器打开”。');
  }
  if (/iPhone|iPad|iPod/iu.test(userAgent)) {
    advice.push('iPhone或iPad建议使用Safari打开。');
  } else if (/Android/iu.test(userAgent)) {
    advice.push('Android建议使用Chrome，并确认Google Play Services for AR可用。');
  }
  return advice.join(' ');
}

function currentStatusCopy(nextStatus: ViewerStatus): string {
  return nextStatus === 'missing'
    ? getMissingModelMessage(appMode)
    : statusCopy(nextStatus);
}

function renderStatus(nextStatus: ViewerStatus): void {
  status = nextStatus;
  viewerFrame.dataset.status = status;
  viewer.setAttribute(
    'aria-busy',
    String(status === 'checking' || status === 'loading'),
  );

  window.clearTimeout(readyTimer);
  const isLoading = status === 'checking' || status === 'loading';
  const hasError = status === 'missing' || status === 'error';

  if (isLoading) {
    loadingPanel.hidden = false;
    loadingPanel.classList.remove('is-complete');
    statusMessage.textContent = currentStatusCopy(status);
  } else if (status === 'ready') {
    statusMessage.textContent = currentStatusCopy(status);
    loadingPanel.classList.add('is-complete');
    readyTimer = window.setTimeout(() => {
      loadingPanel.hidden = true;
    }, reducedMotionQuery.matches ? 0 : READY_TRANSITION_MS);
  } else {
    loadingPanel.hidden = true;
  }

  errorPanel.hidden = !hasError;
  errorMessage.textContent = hasError ? currentStatusCopy(status) : '';
  controls.hidden = status !== 'ready';
}

function initializeModeUi(): void {
  document.body.dataset.appMode = appMode;
  document.title =
    appMode === 'ar'
      ? '六通鲁班锁 AR 查看｜真实尺寸预览'
      : '六通鲁班锁｜手机端3D展示';
  siteTitle.textContent = pageCopy.title;
  siteSubtitle.textContent = pageCopy.subtitle;
  viewerCard.setAttribute('aria-label', pageCopy.regionLabel);
  configureModelViewerForMode(viewer, appMode);

  const isArMode = appMode === 'ar';
  viewerControls.hidden = isArMode;
  viewerArEntry.hidden = isArMode;
  animationPanel.hidden = isArMode;
  arPanel.hidden = !isArMode;
  activateArButton.hidden = !isArMode;
  returnViewerErrorButton.hidden = !isArMode;
  arDeviceAdvice.textContent = isArMode ? deviceAdvice() : '';
}

if (shouldInitializeAnimationController(appMode)) {
  animationController = new AnimationController(
    viewer as unknown as AnimationViewer,
    {
      onStateChange: (nextState, reason) => {
        animationState = nextState;
        animationReason = reason;
        renderAnimationControls();
      },
      onProgress: (nextProgress) => {
        animationProgress = nextProgress;
        renderAnimationControls();
      },
      onPlaybackLockChange: coordinateAutoRotateWithAnimation,
      onAnimationReady: (animationName, duration) => {
        if (import.meta.env.DEV) {
          console.info(
            `model-viewer animation duration: ${animationName} = ${duration}s`,
          );
        }
      },
      onError: (error) => {
        console.error('鲁班锁拆装动画控制失败', {
          modelPath,
          animationName: viewer.animationName,
          error,
        });
      },
    },
  );
} else {
  arController = new ArController(viewer as unknown as ArViewer, {
    isSecureContext: () =>
      import.meta.env.DEV && searchParams.has('simulate-insecure-context')
        ? false
        : window.isSecureContext,
    onStateChange: (nextState) => {
      arState = nextState;
      renderArControls();
    },
    onTrackingChange: (tracking) => {
      arTrackingWarning.hidden = tracking !== 'not-tracking';
    },
    onError: (error) => {
      console.error('AR支持检测失败', { modelPath, error });
    },
  });
}

async function loadModel(forceReload = false): Promise<void> {
  animationController?.prepareForModelLoad();
  arController?.prepareForModelLoad();
  arModelHasAnimations = false;
  renderStatus('checking');
  renderArControls();
  setProgress(0);

  const simulateArMissing =
    import.meta.env.DEV &&
    appMode === 'ar' &&
    searchParams.has('simulate-ar-missing');
  const availabilityPath = simulateArMissing ? `${modelPath}.missing` : modelPath;
  const availability = await checkModelAvailability(availabilityPath);
  if (availability === 'missing') {
    renderStatus('missing');
    return;
  }
  if (availability === 'error') {
    console.error('无法检查3D模型资源', { url: modelPath });
    renderStatus('error');
    return;
  }

  renderStatus('loading');
  retryCount += forceReload ? 1 : 0;
  viewer.src = forceReload ? `${modelPath}?retry=${retryCount}` : modelPath;
}

viewer.addEventListener('progress', (event: Event) => {
  const detail = (event as CustomEvent<ProgressDetail>).detail;
  if (detail && Number.isFinite(detail.totalProgress)) {
    setProgress(detail.totalProgress);
  }
});

viewer.addEventListener('load', () => {
  setProgress(1);
  renderStatus('ready');

  if (appMode === 'ar') {
    const availableAnimations = [...viewer.availableAnimations];
    if (import.meta.env.DEV) {
      console.info(
        `model-viewer AR availableAnimations: ${availableAnimations.join(', ') || '(none)'}`,
      );
    }
    if (availableAnimations.length > 0) {
      arModelHasAnimations = true;
      console.error('AR静态模型不应包含动画', {
        availableAnimations,
        modelPath,
      });
      renderArControls();
      return;
    }
    void arController?.modelReady();
    return;
  }

  const loadedModelId = viewer.src ?? modelPath;
  const simulatedMissingAnimation = import.meta.env.DEV
    ? searchParams.get('simulate-missing-animation')
    : null;
  const availableAnimations = animationsForDevelopment(
    viewer.availableAnimations,
    simulatedMissingAnimation,
    import.meta.env.DEV,
  );
  void animationController
    ?.initializeAnimations(loadedModelId, availableAnimations)
    .then((result) => {
      if (result.status === 'stale') {
        return;
      }

      if (import.meta.env.DEV) {
        console.info(
          `model-viewer availableAnimations: ${result.availableAnimations.join(', ')}`,
        );
      }

      if (result.status === 'unavailable') {
        console.error('当前模型缺少完整的拆装动画', {
          availableAnimations: result.availableAnimations,
          missingAnimations: result.missingAnimations,
          modelPath,
        });
      }
    });
});

viewer.addEventListener('error', (event: Event) => {
  animationController?.prepareForModelLoad();
  arController?.prepareForModelLoad();
  console.error('3D模型加载失败', { url: viewer.src, event });
  renderStatus('error');
});

rotationButton.addEventListener('click', () => {
  if (appMode === 'ar' || rotationLockedForAnimation) {
    return;
  }
  autoRotating = !autoRotating;
  syncRotationControl();
});

resetViewButton.addEventListener('click', () => {
  viewer.cameraOrbit = INITIAL_CAMERA_ORBIT;
  viewer.fieldOfView = INITIAL_FIELD_OF_VIEW;
  viewer.resetTurntableRotation();
  viewer.jumpCameraToGoal();
});

retryButton.addEventListener('click', () => {
  void loadModel(true);
});

disassembleButton.addEventListener('click', () => {
  void animationController?.playDisassemble();
});

assembleButton.addEventListener('click', () => {
  void animationController?.playAssemble();
});

pauseResumeButton.addEventListener('click', () => {
  if (
    animationController?.state === 'paused-disassemble' ||
    animationController?.state === 'paused-assemble'
  ) {
    animationController.resumeCurrentAnimation();
    return;
  }
  animationController?.pauseCurrentAnimation();
});

resetModelButton.addEventListener('click', () => {
  void animationController?.resetToAssembled();
});

function navigateToAr(): void {
  window.location.assign(getArUrl(searchParams, window.location.pathname));
}

function navigateToViewer(): void {
  window.location.assign(getViewerUrl(searchParams, window.location.pathname));
}

enterArButton.addEventListener('click', navigateToAr);
returnViewerButton.addEventListener('click', navigateToViewer);
returnViewerErrorButton.addEventListener('click', navigateToViewer);

activateArButton.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  arController?.activateAr();
});

unavailableArButton.addEventListener('click', () => {
  arController?.activateAr();
});

document.addEventListener('visibilitychange', () => {
  if (appMode !== 'ar') {
    return;
  }
  if (document.hidden) {
    arController?.pageHidden();
  } else {
    arController?.pageVisible();
  }
});

window.addEventListener('pagehide', (event: PageTransitionEvent) => {
  if (appMode === 'ar') {
    arController?.pageHidden();
  } else if (shouldDestroyOnPageHide(event.persisted)) {
    animationController?.destroy();
  }
});

window.addEventListener('pageshow', () => {
  arController?.pageVisible();
});

window.addEventListener(
  'unload',
  () => {
    arController?.destroy();
  },
  { once: true },
);

initializeModeUi();
syncRotationControl();
renderAnimationControls();
renderArControls();
void loadModel();
