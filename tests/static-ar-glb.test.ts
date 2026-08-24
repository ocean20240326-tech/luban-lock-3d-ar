// @ts-nocheck -- Node专用GLB集成测试；项目不为浏览器代码新增@types/node依赖。
import { copyFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createStaticArBuffer,
  measureStaticScene,
  parseGlb,
  serializeGlbWithJson,
  sha256,
  writeStaticArGlb,
} from '../scripts/lib/static-ar-glb.mjs';

const sourcePath = path.resolve('public/models/luban-lock.glb');
const expectedSourceHash =
  '854590B5A6AE2C54CB560D7FDF22A4CD249BB0339323CB68DA7DC64915FB180D';
const structuralKeys = [
  'nodes',
  'meshes',
  'materials',
  'textures',
  'images',
  'samplers',
  'scenes',
  'scene',
  'skins',
  'buffers',
  'bufferViews',
  'accessors',
  'extensionsUsed',
  'extensionsRequired',
] as const;

let source: Buffer;
let result: ReturnType<typeof createStaticArBuffer>;
let temporaryDirectory: string;

beforeAll(async () => {
  source = await readFile(sourcePath);
  result = createStaticArBuffer(source);
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'luban-ar-test-'));
});

afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe('GLB 2.0 解析与静态 AR 衍生', () => {
  it('识别原模型头和精确动画名称', () => {
    const parsed = parseGlb(source);

    expect(parsed.version).toBe(2);
    expect(parsed.declaredLength).toBe(source.byteLength);
    expect(parsed.json.animations?.map((animation) => animation.name)).toEqual([
      'Assemble',
      'Disassemble',
    ]);
  });

  it('输出模型删除 animations 且拥有独立哈希', () => {
    expect(result.sourceAnimationNames).toEqual(['Assemble', 'Disassemble']);
    expect(result.outputJson).not.toHaveProperty('animations');
    expect(parseGlb(result.buffer).json).not.toHaveProperty('animations');
    expect(sha256(source)).toBe(expectedSourceHash);
    expect(sha256(result.buffer)).not.toBe(expectedSourceHash);
  });

  it.each(structuralKeys)('输出模型的 %s 与原模型深度一致', (key) => {
    expect(result.outputJson[key]).toEqual(result.sourceJson[key]);
  });

  it('保留全部非 JSON chunk 的类型和原始字节', () => {
    const sourceChunks = parseGlb(source).chunks.filter((chunk) => !chunk.isJson);
    const outputChunks = parseGlb(result.buffer).chunks.filter(
      (chunk) => !chunk.isJson,
    );

    expect(outputChunks.map((chunk) => chunk.type)).toEqual(
      sourceChunks.map((chunk) => chunk.type),
    );
    expect(
      outputChunks.every((chunk, index) =>
        chunk.data.equals(sourceChunks[index].data),
      ),
    ).toBe(true);
  });

  it('静态组装模型最大尺寸约为 0.075 米且衍生模型尺寸一致', () => {
    const sourceBounds = measureStaticScene(source);
    const outputBounds = measureStaticScene(result.buffer);

    expect(Math.max(...sourceBounds.size)).toBeCloseTo(0.075, 6);
    expect(outputBounds).toEqual(sourceBounds);
  });

  it('拒绝无效 GLB magic', () => {
    const invalid = Buffer.from(source);
    invalid.writeUInt32LE(0, 0);

    expect(() => parseGlb(invalid)).toThrow(/magic/iu);
  });

  it('动画名称不完整时明确拒绝生成', () => {
    const parsed = parseGlb(source);
    const wrongJson = structuredClone(parsed.json);
    wrongJson.animations = [{ name: 'Assemble' }];
    const wrongBuffer = serializeGlbWithJson(parsed, wrongJson);

    expect(() => createStaticArBuffer(wrongBuffer)).toThrow(/Disassemble/u);
  });

  it('通过临时文件验证后写入目标且不改动源文件', async () => {
    const outputPath = path.join(temporaryDirectory, 'luban-lock-ar.glb');
    const report = await writeStaticArGlb(sourcePath, outputPath);
    const written = await readFile(outputPath);
    const remainingFiles = await readdir(temporaryDirectory);

    expect(report.sourceHash).toBe(expectedSourceHash);
    expect(report.outputHash).toBe(sha256(written));
    expect(parseGlb(written).json).not.toHaveProperty('animations');
    expect(sha256(await readFile(sourcePath))).toBe(expectedSourceHash);
    expect(remainingFiles).toEqual(['luban-lock-ar.glb']);
  });

  it.skipIf(process.platform !== 'win32')(
    'Windows大小写路径别名不能绕过原模型防覆盖保护',
    async () => {
      const protectedSource = path.join(temporaryDirectory, 'protected-source.glb');
      const caseAlias = path.join(temporaryDirectory, 'PROTECTED-SOURCE.GLB');
      await copyFile(sourcePath, protectedSource);

      await expect(writeStaticArGlb(protectedSource, caseAlias)).rejects.toThrow(
        /覆盖原动画模型/u,
      );
      expect(sha256(await readFile(protectedSource))).toBe(expectedSourceHash);
    },
  );
});
