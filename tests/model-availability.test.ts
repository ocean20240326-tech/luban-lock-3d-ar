import { describe, expect, it } from 'vitest';

import {
  checkModelAvailability,
  type FetchModel,
} from '../src/model-availability';

function responseFetcher(response: Response): FetchModel {
  return async () => response;
}

describe('checkModelAvailability', () => {
  it('接受成功返回的 GLB 资源', async () => {
    const response = new Response(null, {
      status: 200,
      headers: { 'content-type': 'model/gltf-binary' },
    });

    await expect(
      checkModelAvailability('/models/luban-lock.glb', responseFetcher(response)),
    ).resolves.toBe('available');
  });

  it('把 404 判断为模型缺失', async () => {
    const response = new Response(null, { status: 404 });

    await expect(
      checkModelAvailability('/models/luban-lock.glb', responseFetcher(response)),
    ).resolves.toBe('missing');
  });

  it('识别静态站点返回的 HTML 回退页', async () => {
    const response = new Response('<!doctype html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    await expect(
      checkModelAvailability('/models/luban-lock.glb', responseFetcher(response)),
    ).resolves.toBe('missing');
  });

  it('把网络异常判断为加载错误', async () => {
    const failingFetcher: FetchModel = async () => {
      throw new TypeError('network unavailable');
    };

    await expect(
      checkModelAvailability('/models/luban-lock.glb', failingFetcher),
    ).resolves.toBe('error');
  });
});
