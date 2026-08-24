import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  measureStaticScene,
  parseGlb,
  sha256,
} from './lib/static-ar-glb.mjs';

export const MODEL_HASHES = Object.freeze({
  animated:
    '854590B5A6AE2C54CB560D7FDF22A4CD249BB0339323CB68DA7DC64915FB180D',
  ar: '06EC186E114F4B77BF38A39DF83A4C11AF1B5E3CF4BDFD606CEE3A6E615DF4EB',
});

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const REQUIRED_ANIMATIONS = ['Assemble', 'Disassemble'];
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.svg',
  '.txt',
  '.xml',
]);
const LOCAL_PATH_PATTERNS = [
  { label: 'Windows本机路径', pattern: /[A-Z]:\\Users\\[^\\/\s"']+/iu },
  { label: '正斜杠本机路径', pattern: /[A-Z]:\/Users\/[^\\/\s"']+/iu },
  { label: '本地预览端口', pattern: /127\.0\.0\.1:4174/iu },
  { label: '本地HTTP地址', pattern: /http:\/\/127\.0\.0\.1/iu },
  { label: '本地文件URL', pattern: /file:\/\/\//iu },
];
const SECRET_PATTERNS = [
  { label: '私钥', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u },
  { label: 'GitHub Token', pattern: /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{16,}/u },
  {
    label: 'Cloudflare Token',
    pattern: /(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[:=]\s*[^\s"']+/iu,
  },
  { label: 'OAuth Token', pattern: /OAUTH_TOKEN\s*[:=]\s*[^\s"']+/iu },
];

function fail(message) {
  throw new Error(`dist验证失败：${message}`);
}

function headerBlocks(text) {
  const blocks = new Map();
  let selector;
  for (const rawLine of text.split(/\r?\n/u)) {
    if (rawLine.trim() === '' || rawLine.trimStart().startsWith('#')) {
      continue;
    }
    if (!/^\s/u.test(rawLine)) {
      selector = rawLine.trim();
      blocks.set(selector, []);
      continue;
    }
    if (selector !== undefined) {
      blocks.get(selector).push(rawLine.trim());
    }
  }
  return blocks;
}

export function verifyHeadersConfiguration(text) {
  const blocks = headerBlocks(text);
  const globalHeaders = blocks.get('/*') ?? [];
  const assetHeaders = blocks.get('/assets/*') ?? [];
  const modelHeaders = blocks.get('/models/*.glb') ?? [];
  const allLower = text.toLowerCase();

  if (!globalHeaders.includes('X-Content-Type-Options: nosniff')) {
    fail('_headers缺少X-Content-Type-Options: nosniff。');
  }
  if (
    !globalHeaders.includes(
      'Referrer-Policy: strict-origin-when-cross-origin',
    )
  ) {
    fail('_headers缺少Referrer-Policy。');
  }
  if (
    !assetHeaders.includes(
      'Cache-Control: public, max-age=31536000, immutable',
    )
  ) {
    fail('Vite哈希资源缺少长期immutable缓存。');
  }
  for (const expected of [
    'Content-Type: model/gltf-binary',
    'Content-Disposition: inline',
    'Access-Control-Allow-Origin: *',
  ]) {
    if (!modelHeaders.includes(expected)) {
      fail(`GLB响应头缺少“${expected}”。`);
    }
  }
  if (modelHeaders.some((line) => /immutable|31536000/iu.test(line))) {
    fail('GLB稳定文件名不能使用一年immutable缓存。');
  }
  if (
    !modelHeaders.includes(
      'Cache-Control: public, max-age=3600, must-revalidate',
    )
  ) {
    fail('GLB响应头缺少适中的Cache-Control缓存策略。');
  }
  if (allLower.includes('cross-origin-resource-policy: same-origin')) {
    fail('_headers不能限制GLB为same-origin。');
  }
  if (allLower.includes('camera=()') || allLower.includes('xr-spatial-tracking=()')) {
    fail('_headers不能禁止camera或xr-spatial-tracking。');
  }
  return true;
}

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, root)));
    } else if (entry.isFile()) {
      const fileStat = await stat(absolutePath);
      files.push({
        absolutePath,
        relativePath: path.relative(root, absolutePath).replaceAll('\\', '/'),
        size: fileStat.size,
      });
    }
  }
  return files;
}

function isEnvironmentFile(relativePath) {
  const name = path.posix.basename(relativePath);
  return (
    name === '.env' ||
    name.startsWith('.env.') ||
    name === '.dev.vars' ||
    name.startsWith('.dev.vars.')
  );
}

function verifyRedirects(text) {
  const dangerous = text
    .split(/\r?\n/u)
    .some((line) => /^\s*\/\*\s+\/index\.html\s+200(?:\s|$)/u.test(line));
  if (dangerous) {
    fail('_redirects包含危险的SPA catch-all，模型缺失将无法返回真实404。');
  }
}

function verifyModel(buffer, options) {
  const hash = sha256(buffer);
  if (hash !== options.expectedHash) {
    fail(`${options.label}SHA-256哈希不符合基线。`);
  }
  if (buffer.byteLength <= 1024) {
    fail(`${options.label}文件过小，疑似占位文件。`);
  }
  if (buffer.byteLength >= MAX_FILE_BYTES) {
    fail(`${options.label}超过25MiB限制。`);
  }
  const prefix = buffer.subarray(0, 64).toString('utf8').toLowerCase();
  if (prefix.includes('<!doctype') || prefix.includes('<html')) {
    fail(`${options.label}实际是HTML而不是GLB。`);
  }
  const parsed = parseGlb(buffer);
  const animationNames = (parsed.json.animations ?? []).map((item) => item?.name);
  if (JSON.stringify(animationNames) !== JSON.stringify(options.animations)) {
    fail(
      `${options.label}动画不符合预期：${animationNames.join(', ') || '(none)'}。`,
    );
  }
  const bounds = measureStaticScene(buffer);
  const maxSize = Math.max(...bounds.size);
  if (Math.abs(maxSize - 0.075) > 0.000001) {
    fail(`${options.label}最大尺寸不再约为0.075米。`);
  }
  return { hash, animationNames, size: buffer.byteLength, maxSize };
}

function scanText(relativePath, text) {
  const matches = [];
  for (const candidate of [...LOCAL_PATH_PATTERNS, ...SECRET_PATTERNS]) {
    if (candidate.pattern.test(text)) {
      matches.push({ file: relativePath, category: candidate.label });
    }
  }
  return matches;
}

export async function verifyDist({ projectRoot = process.cwd() } = {}) {
  const resolvedRoot = path.resolve(projectRoot);
  const distRoot = path.join(resolvedRoot, 'dist');
  const requiredPaths = [
    'index.html',
    '404.html',
    'models/luban-lock.glb',
    'models/luban-lock-ar.glb',
    '_headers',
  ];
  for (const relativePath of requiredPaths) {
    try {
      await stat(path.join(distRoot, relativePath));
    } catch {
      fail(`缺少dist/${relativePath}。`);
    }
  }

  for (const forbiddenPath of [
    'functions',
    '_worker.js',
    'wrangler.toml',
    'wrangler.json',
    'wrangler.jsonc',
  ]) {
    try {
      await stat(path.join(resolvedRoot, forbiddenPath));
      fail(`项目根目录存在不允许的Pages Functions或Worker入口：${forbiddenPath}。`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('dist验证失败：')) {
        throw error;
      }
    }
  }
  const assetsPath = path.join(distRoot, 'assets');
  const assets = await listFiles(assetsPath).catch(() => []);
  if (assets.length === 0) {
    fail('dist/assets/不存在或没有构建资源。');
  }

  const files = await listFiles(distRoot);
  for (const file of files) {
    if (file.size >= MAX_FILE_BYTES) {
      fail(`dist/${file.relativePath}超过25MiB限制。`);
    }
    if (isEnvironmentFile(file.relativePath)) {
      fail(`dist中不允许出现环境变量文件：${file.relativePath}。`);
    }
    const segments = file.relativePath.split('/');
    if (segments.includes('functions') || path.posix.basename(file.relativePath) === '_worker.js') {
      fail(`dist中出现Cloudflare运行时代码：${file.relativePath}。`);
    }
  }

  const sourceAnimatedPath = path.join(
    resolvedRoot,
    'public/models/luban-lock.glb',
  );
  const sourceArPath = path.join(
    resolvedRoot,
    'public/models/luban-lock-ar.glb',
  );
  const [sourceAnimated, sourceAr, distAnimated, distAr, html, headers] =
    await Promise.all([
      readFile(sourceAnimatedPath),
      readFile(sourceArPath),
      readFile(path.join(distRoot, 'models/luban-lock.glb')),
      readFile(path.join(distRoot, 'models/luban-lock-ar.glb')),
      readFile(path.join(distRoot, 'index.html'), 'utf8'),
      readFile(path.join(distRoot, '_headers'), 'utf8'),
    ]);

  if (sha256(sourceAnimated) !== MODEL_HASHES.animated) {
    fail('public普通模型SHA-256不符合受保护基线。');
  }
  if (sha256(sourceAr) !== MODEL_HASHES.ar) {
    fail('public AR模型SHA-256不符合受保护基线。');
  }
  if (sha256(distAnimated) !== sha256(sourceAnimated)) {
    fail('dist普通模型与public普通模型哈希不一致。');
  }
  if (sha256(distAr) !== sha256(sourceAr)) {
    fail('dist AR模型与public AR模型哈希不一致。');
  }

  const animatedModel = verifyModel(distAnimated, {
    label: 'dist普通模型',
    expectedHash: MODEL_HASHES.animated,
    animations: REQUIRED_ANIMATIONS,
  });
  const arModel = verifyModel(distAr, {
    label: 'dist AR模型',
    expectedHash: MODEL_HASHES.ar,
    animations: [],
  });
  if (animatedModel.maxSize !== arModel.maxSize) {
    fail('普通模型与AR模型静态尺寸不一致。');
  }

  const htmlForbidden = LOCAL_PATH_PATTERNS.filter((item) => item.pattern.test(html));
  if (htmlForbidden.length > 0) {
    fail(`dist/index.html包含本机路径或本地地址：${htmlForbidden[0].label}。`);
  }
  verifyHeadersConfiguration(headers);

  const redirectsFile = files.find((file) => file.relativePath === '_redirects');
  if (redirectsFile) {
    verifyRedirects(await readFile(redirectsFile.absolutePath, 'utf8'));
  }

  const localPathMatches = [];
  let deployedText = '';
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(file.relativePath).toLowerCase())) {
      continue;
    }
    const text = await readFile(file.absolutePath, 'utf8');
    deployedText += `\n${text}`;
    localPathMatches.push(...scanText(file.relativePath, text));
  }
  if (localPathMatches.length > 0) {
    const first = localPathMatches[0];
    fail(`dist/${first.file}包含本机路径、本地地址或秘密类别：${first.category}。`);
  }
  for (const modelUrl of [
    '/models/luban-lock.glb',
    '/models/luban-lock-ar.glb',
  ]) {
    if (!deployedText.includes(modelUrl)) {
      fail(`生产资源中缺少根相对模型URL：${modelUrl}。`);
    }
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);
  const largestFile = files.reduce((largest, file) =>
    file.size > largest.size ? file : largest,
  );
  return {
    fileCount: files.length,
    totalSize,
    largestFile: {
      path: largestFile.relativePath,
      size: largestFile.size,
    },
    animatedModel,
    arModel,
    headersValid: true,
    localPathMatches,
    conclusion: 'dist适合Cloudflare Pages纯静态部署',
  };
}

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} bytes`;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const report = await verifyDist();
    console.info('生产构建目录验证通过');
    console.info(`dist文件数量：${report.fileCount}`);
    console.info(`dist总大小：${formatBytes(report.totalSize)}`);
    console.info(
      `最大单文件：${report.largestFile.path} (${formatBytes(report.largestFile.size)})`,
    );
    console.info(`普通模型SHA-256：${report.animatedModel.hash}`);
    console.info(`AR模型SHA-256：${report.arModel.hash}`);
    console.info(`普通模型动画数量：${report.animatedModel.animationNames.length}`);
    console.info(`AR模型动画数量：${report.arModel.animationNames.length}`);
    console.info('_headers验证：通过');
    console.info('本地路径与秘密扫描：未发现问题');
    console.info(`最终结论：${report.conclusion}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
