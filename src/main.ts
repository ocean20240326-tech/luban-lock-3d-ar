import '@google/model-viewer';
import type { ModelViewerElement } from '@google/model-viewer';

import { checkModelAvailability } from './model-availability';
import './style.css';
import {
  clampProgress,
  initialAutoRotate,
  statusCopy,
  type ViewerStatus,
} from './viewer-state';

const MODEL_URL = '/models/luban-lock.glb';
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

const viewer = requireElement<ModelViewerElement>('#lubanViewer');
const viewerFrame = requireElement<HTMLElement>('#viewerFrame');
const loadingPanel = requireElement<HTMLElement>('#loadingPanel');
const progressBar = requireElement<HTMLElement>('#progressBar');
const progressFill = requireElement<HTMLElement>('#progressFill');
const progressText = requireElement<HTMLElement>('#progressText');
const statusMessage = requireElement<HTMLElement>('#statusMessage');
const errorPanel = requireElement<HTMLElement>('#errorPanel');
const errorMessage = requireElement<HTMLElement>('#errorMessage');
const retryButton = requireElement<HTMLButtonElement>('#retryButton');
const controls = requireElement<HTMLElement>('#controls');
const rotationButton = requireElement<HTMLButtonElement>('#rotationButton');
const rotationButtonText = requireElement<HTMLElement>('#rotationButtonText');
const resetViewButton = requireElement<HTMLButtonElement>('#resetViewButton');

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let status: ViewerStatus = 'checking';
let progress = 0;
let retryCount = 0;
let readyTimer: number | undefined;
let autoRotating = initialAutoRotate(reducedMotionQuery.matches);

function setProgress(nextProgress: number): void {
  progress = clampProgress(nextProgress);
  progressText.textContent = `${progress}%`;
  progressBar.setAttribute('aria-valuenow', String(progress));
  progressFill.style.setProperty('--load-progress', `${progress}%`);
}

function syncRotationControl(): void {
  viewer.toggleAttribute('auto-rotate', autoRotating);
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

function renderStatus(nextStatus: ViewerStatus): void {
  status = nextStatus;
  viewerFrame.dataset.status = status;
  viewer.setAttribute('aria-busy', String(status === 'checking' || status === 'loading'));

  window.clearTimeout(readyTimer);
  const isLoading = status === 'checking' || status === 'loading';
  const hasError = status === 'missing' || status === 'error';

  if (isLoading) {
    loadingPanel.hidden = false;
    loadingPanel.classList.remove('is-complete');
    statusMessage.textContent = statusCopy(status);
  } else if (status === 'ready') {
    statusMessage.textContent = statusCopy(status);
    loadingPanel.classList.add('is-complete');
    readyTimer = window.setTimeout(() => {
      loadingPanel.hidden = true;
    }, reducedMotionQuery.matches ? 0 : READY_TRANSITION_MS);
  } else {
    loadingPanel.hidden = true;
  }

  errorPanel.hidden = !hasError;
  errorMessage.textContent = hasError ? statusCopy(status) : '';
  controls.hidden = status !== 'ready';
}

async function loadModel(forceReload = false): Promise<void> {
  renderStatus('checking');
  setProgress(0);

  const availability = await checkModelAvailability(MODEL_URL);
  if (availability === 'missing') {
    renderStatus('missing');
    return;
  }
  if (availability === 'error') {
    console.error('无法检查3D模型资源', { url: MODEL_URL });
    renderStatus('error');
    return;
  }

  renderStatus('loading');
  retryCount += forceReload ? 1 : 0;
  viewer.src = forceReload ? `${MODEL_URL}?retry=${retryCount}` : MODEL_URL;
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
});

viewer.addEventListener('error', (event: Event) => {
  console.error('3D模型加载失败', { url: viewer.src, event });
  renderStatus('error');
});

rotationButton.addEventListener('click', () => {
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

syncRotationControl();
void loadModel();
