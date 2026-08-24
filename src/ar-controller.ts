import {
  canOfferAr,
  isArStatusEventDetail,
  mapArStatus,
  resolveArSupport,
  type ArState,
} from './ar-state';

export interface ArViewer extends EventTarget {
  readonly canActivateAR: boolean;
  readonly updateComplete: Promise<boolean>;
  activateAR(): Promise<void>;
}

export interface ArControllerOptions {
  isSecureContext?: () => boolean;
  capabilityCheckAttempts?: number;
  waitForCapabilityUpdate?: () => Promise<void>;
  onStateChange?: (state: ArState) => void;
  onTrackingChange?: (status: 'tracking' | 'not-tracking') => void;
  onError?: (error: Error) => void;
}

function trackingStatus(detail: unknown): 'tracking' | 'not-tracking' | undefined {
  if (typeof detail !== 'object' || detail === null || !('status' in detail)) {
    return undefined;
  }
  const status = (detail as { status?: unknown }).status;
  return status === 'tracking' || status === 'not-tracking' ? status : undefined;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export class ArController {
  state: ArState = 'checking';

  private readonly viewer: ArViewer;
  private readonly options: ArControllerOptions;
  private readonly isSecureContext: () => boolean;
  private readonly capabilityCheckAttempts: number;
  private readonly waitForCapabilityUpdate: () => Promise<void>;
  private generation = 0;
  private launchGeneration = 0;
  private hasLaunched = false;
  private hiddenAfterLaunch = false;
  private destroyed = false;

  private readonly arStatusHandler = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!isArStatusEventDetail(detail) || this.destroyed) {
      return;
    }
    this.setState(mapArStatus(this.state, detail.status, this.hasLaunched));
  };

  private readonly arTrackingHandler = (event: Event): void => {
    const status = trackingStatus((event as CustomEvent<unknown>).detail);
    if (status !== undefined && !this.destroyed) {
      this.options.onTrackingChange?.(status);
    }
  };

  constructor(viewer: ArViewer, options: ArControllerOptions = {}) {
    this.viewer = viewer;
    this.options = options;
    this.isSecureContext = options.isSecureContext ?? (() => window.isSecureContext);
    this.capabilityCheckAttempts = Math.max(
      1,
      options.capabilityCheckAttempts ?? 120,
    );
    this.waitForCapabilityUpdate =
      options.waitForCapabilityUpdate ?? nextAnimationFrame;
    this.viewer.addEventListener('ar-status', this.arStatusHandler);
    this.viewer.addEventListener('ar-tracking', this.arTrackingHandler);
  }

  async modelReady(): Promise<ArState> {
    const generation = ++this.generation;
    this.setState('checking');
    try {
      await this.viewer.updateComplete;
      if (!this.isCurrent(generation)) {
        return this.state;
      }
      if (!this.isSecureContext()) {
        this.setState('insecure-context');
        return this.state;
      }
      for (let attempt = 0; attempt < this.capabilityCheckAttempts; attempt += 1) {
        if (!this.isCurrent(generation)) {
          return this.state;
        }
        if (this.viewer.canActivateAR) {
          this.setState('ready');
          return this.state;
        }
        if (attempt + 1 < this.capabilityCheckAttempts) {
          await this.waitForCapabilityUpdate();
        }
      }
      if (this.isCurrent(generation)) {
        this.setState(
          resolveArSupport({
            modelLoaded: true,
            isSecureContext: true,
            canActivateAR: false,
          }),
        );
      }
      return this.state;
    } catch (error) {
      if (this.isCurrent(generation)) {
        const safeError = error instanceof Error ? error : new Error(String(error));
        this.setState('failed');
        this.options.onError?.(safeError);
      }
      return this.state;
    }
  }

  activateAr(): boolean {
    if (this.destroyed || !canOfferAr(this.state)) {
      return false;
    }
    if (!this.viewer.canActivateAR) {
      this.setState('unsupported');
      return false;
    }
    const launchGeneration = ++this.launchGeneration;
    this.hasLaunched = true;
    this.hiddenAfterLaunch = false;
    this.setState('launching');
    try {
      const activation = this.viewer.activateAR();
      void activation.catch((error: unknown) => {
        this.handleActivationFailure(launchGeneration, error);
      });
    } catch (error) {
      this.handleActivationFailure(launchGeneration, error);
    }
    return true;
  }

  prepareForModelLoad(): void {
    if (this.destroyed) {
      return;
    }
    ++this.generation;
    ++this.launchGeneration;
    this.hasLaunched = false;
    this.hiddenAfterLaunch = false;
    this.setState('checking');
  }

  pageHidden(): void {
    if (this.hasLaunched) {
      this.hiddenAfterLaunch = true;
    }
  }

  pageVisible(): void {
    if (!this.hiddenAfterLaunch || this.destroyed) {
      return;
    }
    this.hiddenAfterLaunch = false;
    if (
      this.state === 'launching' ||
      this.state === 'session-started' ||
      this.state === 'object-placed'
    ) {
      ++this.launchGeneration;
      this.setState('returned');
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    ++this.generation;
    ++this.launchGeneration;
    this.viewer.removeEventListener('ar-status', this.arStatusHandler);
    this.viewer.removeEventListener('ar-tracking', this.arTrackingHandler);
  }

  private isCurrent(generation: number): boolean {
    return !this.destroyed && generation === this.generation;
  }

  private handleActivationFailure(
    launchGeneration: number,
    error: unknown,
  ): void {
    if (
      this.destroyed ||
      launchGeneration !== this.launchGeneration ||
      (this.state !== 'launching' &&
        this.state !== 'session-started' &&
        this.state !== 'object-placed')
    ) {
      return;
    }
    const safeError = error instanceof Error ? error : new Error(String(error));
    this.setState('failed');
    this.options.onError?.(safeError);
  }

  private setState(state: ArState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }
}
