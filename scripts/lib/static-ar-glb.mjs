import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const REQUIRED_ANIMATIONS = ['Assemble', 'Disassemble'];
const STRUCTURAL_KEYS = [
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
];

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

export function parseGlb(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.byteLength < 12) {
    throw new Error('GLB头不足12字节。');
  }

  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (magic !== GLB_MAGIC) {
    throw new Error('GLB magic无效，文件不是二进制glTF。');
  }
  if (version !== GLB_VERSION) {
    throw new Error(`GLB version必须为2，实际为${version}。`);
  }
  if (declaredLength !== buffer.byteLength) {
    throw new Error(
      `GLB声明长度${declaredLength}与实际长度${buffer.byteLength}不一致。`,
    );
  }

  const chunks = [];
  let offset = 12;
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) {
      throw new Error('GLB chunk头被截断。');
    }
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (length % 4 !== 0 || dataEnd > buffer.byteLength) {
      throw new Error('GLB chunk长度无效或数据被截断。');
    }
    chunks.push({
      type,
      data: Buffer.from(buffer.subarray(dataStart, dataEnd)),
      isJson: type === JSON_CHUNK_TYPE,
    });
    offset = dataEnd;
  }

  if (offset !== buffer.byteLength) {
    throw new Error('GLB chunk边界与文件长度不一致。');
  }
  const jsonIndexes = chunks
    .map((chunk, index) => (chunk.isJson ? index : -1))
    .filter((index) => index >= 0);
  if (jsonIndexes.length !== 1) {
    throw new Error(`GLB必须且只能包含一个JSON chunk，实际为${jsonIndexes.length}。`);
  }

  const jsonChunkIndex = jsonIndexes[0];
  const jsonText = chunks[jsonChunkIndex].data
    .toString('utf8')
    .replace(/[\u0000\u0020]+$/u, '');
  let json;
  try {
    json = JSON.parse(jsonText);
  } catch (error) {
    throw new Error('GLB JSON chunk无法解析。', { cause: error });
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('GLB JSON顶层必须是对象。');
  }

  return { version, declaredLength, chunks, jsonChunkIndex, json };
}

export function serializeGlbWithJson(parsed, json) {
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const paddingLength = (4 - (jsonBytes.byteLength % 4)) % 4;
  const paddedJson = Buffer.concat([
    jsonBytes,
    Buffer.alloc(paddingLength, 0x20),
  ]);
  const chunks = parsed.chunks.map((chunk, index) => ({
    type: chunk.type,
    data: index === parsed.jsonChunkIndex ? paddedJson : chunk.data,
  }));
  const totalLength = 12 + chunks.reduce(
    (total, chunk) => total + 8 + chunk.data.byteLength,
    0,
  );
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(GLB_VERSION, 4);
  output.writeUInt32LE(totalLength, 8);

  let offset = 12;
  for (const chunk of chunks) {
    output.writeUInt32LE(chunk.data.byteLength, offset);
    output.writeUInt32LE(chunk.type, offset + 4);
    chunk.data.copy(output, offset + 8);
    offset += 8 + chunk.data.byteLength;
  }
  return output;
}

function validateAnimationNames(json) {
  if (!Array.isArray(json.animations)) {
    throw new Error('原模型缺少animations数组，无法生成AR静态模型。');
  }
  const names = json.animations.map((animation) => animation?.name);
  const missing = REQUIRED_ANIMATIONS.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    throw new Error(`原模型缺少必需动画：${missing.join(', ')}。`);
  }
  return names.map((name) => String(name));
}

function validateStaticDerivative(sourceBuffer, outputBuffer) {
  const source = parseGlb(sourceBuffer);
  const output = parseGlb(outputBuffer);
  if ('animations' in output.json && output.json.animations?.length !== 0) {
    throw new Error('AR输出模型仍包含可播放动画。');
  }
  for (const key of STRUCTURAL_KEYS) {
    assert.deepStrictEqual(
      output.json[key],
      source.json[key],
      `AR输出模型的${key}发生变化。`,
    );
  }
  const sourceNonJson = source.chunks.filter((chunk) => !chunk.isJson);
  const outputNonJson = output.chunks.filter((chunk) => !chunk.isJson);
  assert.equal(
    outputNonJson.length,
    sourceNonJson.length,
    '非JSON chunk数量发生变化。',
  );
  sourceNonJson.forEach((chunk, index) => {
    assert.equal(outputNonJson[index].type, chunk.type, '非JSON chunk类型发生变化。');
    assert.deepStrictEqual(
      outputNonJson[index].data,
      chunk.data,
      '非JSON chunk字节发生变化。',
    );
  });
  return true;
}

export function createStaticArBuffer(sourceBuffer) {
  const sourceHash = sha256(sourceBuffer);
  const parsed = parseGlb(sourceBuffer);
  const sourceAnimationNames = validateAnimationNames(parsed.json);
  const outputJson = structuredClone(parsed.json);
  delete outputJson.animations;
  const buffer = serializeGlbWithJson(parsed, outputJson);
  validateStaticDerivative(sourceBuffer, buffer);
  if (sha256(sourceBuffer) !== sourceHash) {
    throw new Error('生成过程中原模型字节发生变化。');
  }
  return {
    buffer,
    sourceJson: parsed.json,
    outputJson,
    sourceAnimationNames,
    sourceHash,
    outputHash: sha256(buffer),
  };
}

export async function writeStaticArGlb(inputPath, outputPath) {
  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);
  const normalizedInput = path.normalize(resolvedInput);
  const normalizedOutput = path.normalize(resolvedOutput);
  const sameNormalizedPath =
    process.platform === 'win32'
      ? normalizedInput.toLocaleLowerCase('en-US') ===
        normalizedOutput.toLocaleLowerCase('en-US')
      : normalizedInput === normalizedOutput;
  let sameExistingFile = false;
  if (!sameNormalizedPath) {
    try {
      const [inputStats, outputStats] = await Promise.all([
        stat(resolvedInput),
        stat(resolvedOutput),
      ]);
      sameExistingFile =
        inputStats.dev === outputStats.dev && inputStats.ino === outputStats.ino;
    } catch {
      // 目标通常尚不存在；后续写入流程会单独报告真实的I/O错误。
    }
  }
  if (sameNormalizedPath || sameExistingFile) {
    throw new Error('AR输出路径不能覆盖原动画模型。');
  }

  const sourceBuffer = await readFile(resolvedInput);
  const result = createStaticArBuffer(sourceBuffer);
  await mkdir(path.dirname(resolvedOutput), { recursive: true });
  const temporaryPath = `${resolvedOutput}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;

  try {
    await writeFile(temporaryPath, result.buffer, { flag: 'wx' });
    const temporaryBuffer = await readFile(temporaryPath);
    validateStaticDerivative(sourceBuffer, temporaryBuffer);
    if (sha256(temporaryBuffer) !== result.outputHash) {
      throw new Error('临时AR模型校验哈希不一致。');
    }
    if (sha256(await readFile(resolvedInput)) !== result.sourceHash) {
      throw new Error('原动画模型在写入AR衍生文件期间发生变化。');
    }
    await rename(temporaryPath, resolvedOutput);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return {
    inputPath: resolvedInput,
    outputPath: resolvedOutput,
    sourceHash: result.sourceHash,
    outputHash: result.outputHash,
    sourceAnimationNames: result.sourceAnimationNames,
    outputAnimationCount: 0,
    sourceSize: sourceBuffer.byteLength,
    outputSize: result.buffer.byteLength,
    validation: '通过',
  };
}

function multiplyMatrices(a, b) {
  const output = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        output[column * 4 + row] +=
          a[index * 4 + row] * b[column * 4 + index];
      }
    }
  }
  return output;
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix)) {
    return [...node.matrix];
  }
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function transformPoint(matrix, point) {
  return [
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
  ];
}

function readPositionAccessor(json, binaryChunk, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  const view = json.bufferViews?.[accessor?.bufferView];
  if (
    !accessor ||
    !view ||
    accessor.type !== 'VEC3' ||
    accessor.componentType !== 5126 ||
    accessor.sparse
  ) {
    throw new Error('当前尺寸验证仅支持非稀疏FLOAT VEC3 POSITION accessor。');
  }
  const componentBytes = 4;
  const stride = view.byteStride ?? componentBytes * 3;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const points = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const offset = start + index * stride;
    if (offset + 12 > binaryChunk.byteLength) {
      throw new Error('POSITION accessor越过BIN chunk边界。');
    }
    points.push([
      binaryChunk.readFloatLE(offset),
      binaryChunk.readFloatLE(offset + 4),
      binaryChunk.readFloatLE(offset + 8),
    ]);
  }
  return points;
}

export function measureStaticScene(input) {
  const parsed = parseGlb(input);
  const json = parsed.json;
  const binaryChunk = parsed.chunks.find((chunk) => chunk.type === BIN_CHUNK_TYPE)?.data;
  if (!binaryChunk) {
    throw new Error('GLB缺少BIN chunk，无法验证静态尺寸。');
  }
  const sceneIndex = json.scene ?? 0;
  const scene = json.scenes?.[sceneIndex];
  if (!scene || !Array.isArray(scene.nodes)) {
    throw new Error('GLB默认scene无效。');
  }

  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  let vertexCount = 0;
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  const visitNode = (nodeIndex, parentMatrix) => {
    const node = json.nodes?.[nodeIndex];
    if (!node) {
      throw new Error(`scene引用了无效node索引${nodeIndex}。`);
    }
    const worldMatrix = multiplyMatrices(parentMatrix, nodeMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = json.meshes?.[node.mesh];
      if (!mesh) {
        throw new Error(`node引用了无效mesh索引${node.mesh}。`);
      }
      for (const primitive of mesh.primitives ?? []) {
        const positionAccessor = primitive.attributes?.POSITION;
        if (positionAccessor === undefined) {
          continue;
        }
        for (const point of readPositionAccessor(json, binaryChunk, positionAccessor)) {
          const worldPoint = transformPoint(worldMatrix, point);
          for (let axis = 0; axis < 3; axis += 1) {
            minimum[axis] = Math.min(minimum[axis], worldPoint[axis]);
            maximum[axis] = Math.max(maximum[axis], worldPoint[axis]);
          }
          vertexCount += 1;
        }
      }
    }
    for (const childIndex of node.children ?? []) {
      visitNode(childIndex, worldMatrix);
    }
  };

  for (const rootNode of scene.nodes) {
    visitNode(rootNode, identity);
  }
  if (vertexCount === 0) {
    throw new Error('默认scene没有可测量的POSITION顶点。');
  }
  return {
    min: minimum,
    max: maximum,
    size: minimum.map((value, axis) => maximum[axis] - value),
    vertexCount,
  };
}
