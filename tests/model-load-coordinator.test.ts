import { describe, expect, it, vi } from 'vitest';

import {
  assignModelSourceAfterUpdate,
  coordinateModelAvailability,
  type FetchModel,
} from '../src/model-availability';

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('模型加载与资源检查协调', () => {
  it('等待model-viewer当前更新完成后再设置src', async () => {
    let finishUpdate!: () => void;
    const viewer = {
      src: '',
      updateComplete: new Promise<void>((resolve) => {
        finishUpdate = resolve;
      }),
    };

    const assignment = assignModelSourceAfterUpdate(
      viewer,
      '/models/luban-lock-ar.glb',
    );

    expect(viewer.src).toBe('');
    finishUpdate();
    await assignment;
    expect(viewer.src).toBe('/models/luban-lock-ar.glb');
  });

  it('AR模式在HEAD检查完成前立即交给model-viewer加载', async () => {
    const pending = deferredResponse();
    const fetchModel: FetchModel = async () => pending.promise;
    const startLoading = vi.fn();

    const result = coordinateModelAvailability(
      '/models/luban-lock-ar.glb',
      { eager: true, startLoading },
      fetchModel,
    );

    expect(startLoading).toHaveBeenCalledOnce();
    pending.resolve(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'model/gltf-binary' },
      }),
    );
    await expect(result).resolves.toBe('available');
    expect(startLoading).toHaveBeenCalledOnce();
  });

  it('普通模式仍在资源检查通过后才加载模型', async () => {
    const pending = deferredResponse();
    const fetchModel: FetchModel = async () => pending.promise;
    const startLoading = vi.fn();

    const result = coordinateModelAvailability(
      '/models/luban-lock.glb',
      { eager: false, startLoading },
      fetchModel,
    );

    expect(startLoading).not.toHaveBeenCalled();
    pending.resolve(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'model/gltf-binary' },
      }),
    );
    await expect(result).resolves.toBe('available');
    expect(startLoading).toHaveBeenCalledOnce();
  });

  it('普通模式资源缺失时不会设置模型地址', async () => {
    const fetchModel: FetchModel = async () =>
      new Response(null, { status: 404 });
    const startLoading = vi.fn();

    await expect(
      coordinateModelAvailability(
        '/models/luban-lock.glb',
        { eager: false, startLoading },
        fetchModel,
      ),
    ).resolves.toBe('missing');
    expect(startLoading).not.toHaveBeenCalled();
  });
});
