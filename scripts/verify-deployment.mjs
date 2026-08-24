import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseGlb, sha256 } from './lib/static-ar-glb.mjs';

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
const REQUIRED_ANIMATIONS = ['Assemble', 'Disassemble'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const LOCAL_PATH_PATTERNS = [
  /[A-Z]:\\Users\\[^\\/\s"']+/iu,
  /[A-Z]:\/Users\/[^\\/\s"']+/iu,
  /127\.0\.0\.1:4174/iu,
  /http:\/\/127\.0\.0\.1/iu,
  /file:\/\/\//iu,
];

function deploymentError(message) {
  return new Error(`部署验证失败：${message}`);
}

export function validateDeploymentUrl(input, { allowHttpLocalhost = false } = {}) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw deploymentError('请提供要验证的基础URL。');
  }
  let url;
  try {
    url = new URL(input);
  } catch {
    throw deploymentError('基础URL格式无效。');
  }
  if (url.username !== '' || url.password !== '') {
    throw deploymentError('URL中不能包含账号、密码或Token。');
  }
  const localHttp =
    allowHttpLocalhost &&
    url.protocol === 'http:' &&
    LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) {
    throw deploymentError('正式部署地址必须使用HTTPS。');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw deploymentError('只支持HTTP(S) URL。');
  }
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  url.search = '';
  url.hash = '';
  return url;
}

export function ensureNoHttpDowngrade(baseUrl, finalUrl) {
  if (baseUrl.protocol === 'https:' && finalUrl.protocol !== 'https:') {
    throw deploymentError(`HTTPS请求被降级到HTTP：${finalUrl.origin}。`);
  }
  return true;
}

export async function requestWithTimeout(
  input,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(input, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: '*/*' },
    });
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
      throw deploymentError(
        `响应体超过${maxResponseBytes} bytes限制：${new URL(input).pathname}。`,
      );
    }

    const chunks = [];
    let totalBytes = 0;
    if (response.body !== null) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          totalBytes += value.byteLength;
          if (totalBytes > maxResponseBytes) {
            await reader.cancel();
            throw deploymentError(
              `响应体超过${maxResponseBytes} bytes限制：${new URL(input).pathname}。`,
            );
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
    }
    return { response, body: Buffer.concat(chunks, totalBytes) };
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw deploymentError(`请求超时（${timeoutMs}ms）：${new URL(input).pathname}。`);
    }
    if (error instanceof Error && error.message.startsWith('部署验证失败：')) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw deploymentError(`网络、DNS或TLS请求失败：${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function cacheControlDirectives(value) {
  const directives = new Map();
  for (const part of String(value ?? '').split(',')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    const name = rawName.toLowerCase();
    if (name === '') {
      continue;
    }
    if (directives.has(name)) {
      throw deploymentError(`Cache-Control包含重复指令：${name}。`);
    }
    directives.set(
      name,
      rawValue.length === 0
        ? true
        : rawValue.join('=').trim().replace(/^"|"$/gu, ''),
    );
  }
  return directives;
}

export function verifyImmutableAssetCache(cacheControl) {
  const directives = cacheControlDirectives(cacheControl);
  const forbidden = ['no-store', 'private', 'no-cache', 's-maxage'];
  if (
    directives.get('public') !== true ||
    directives.get('max-age') !== '31536000' ||
    directives.get('immutable') !== true ||
    forbidden.some((directive) => directives.has(directive))
  ) {
    throw deploymentError('Vite哈希资源缺少精确的一年immutable缓存策略。');
  }
  return true;
}

function assertNoLocalPaths(label, body) {
  if (LOCAL_PATH_PATTERNS.some((pattern) => pattern.test(body))) {
    throw deploymentError(`${label}包含本机绝对路径或本地预览地址。`);
  }
}

export function verifyHtmlPayload({ label, status, contentType, body }) {
  if (status !== 200) {
    throw deploymentError(`${label}应返回HTTP 200，实际为${status}。`);
  }
  if (!String(contentType ?? '').toLowerCase().includes('text/html')) {
    throw deploymentError(`${label}的Content-Type不是text/html。`);
  }
  if (!String(body).includes('六通鲁班锁')) {
    throw deploymentError(`${label}没有包含项目标题。`);
  }
  assertNoLocalPaths(label, String(body));
  return true;
}

export function verifyModelPayload({
  label,
  status,
  contentType,
  cors,
  cacheControl,
  buffer,
  expectedHash,
  expectedAnimations,
}) {
  if (status !== 200) {
    throw deploymentError(`${label}应返回HTTP 200，实际为${status}。`);
  }
  const mime = String(contentType ?? '').split(';', 1)[0].trim().toLowerCase();
  if (mime !== 'model/gltf-binary') {
    throw deploymentError(`${label}的Content-Type必须为model/gltf-binary。`);
  }
  if (String(cors ?? '').trim() !== '*') {
    throw deploymentError(`${label}缺少Access-Control-Allow-Origin: * CORS响应头。`);
  }
  const cache = cacheControlDirectives(cacheControl);
  const forbiddenCacheDirectives = [
    's-maxage',
    'immutable',
    'private',
    'no-store',
    'no-cache',
  ];
  if (
    cache.get('public') !== true ||
    cache.get('max-age') !== '3600' ||
    cache.get('must-revalidate') !== true ||
    forbiddenCacheDirectives.some((directive) => cache.has(directive))
  ) {
    throw deploymentError(`${label}的Cache-Control不是预期的适中缓存策略。`);
  }
  const actualHash = sha256(buffer);
  if (actualHash !== expectedHash) {
    throw deploymentError(`${label}的SHA-256与本地模型不一致。`);
  }
  const parsed = parseGlb(buffer);
  const animations = (parsed.json.animations ?? []).map((item) => item?.name);
  if (JSON.stringify(animations) !== JSON.stringify(expectedAnimations)) {
    throw deploymentError(
      `${label}动画不符合预期：${animations.join(', ') || '(none)'}。`,
    );
  }
  return { hash: actualHash, animations };
}

export function verifyMissingModelPayload({ status, contentType, body }) {
  if (status !== 404) {
    const fallback =
      status === 200 && String(contentType ?? '').toLowerCase().includes('text/html')
        ? '，且返回了首页HTML回退'
        : '';
    throw deploymentError(`缺失模型必须返回404，实际为${status}${fallback}。`);
  }
  return true;
}

function verifyGlobalHeaders(headers, label) {
  if (headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff') {
    throw deploymentError(`${label}缺少X-Content-Type-Options: nosniff。`);
  }
  if (
    headers.get('referrer-policy')?.toLowerCase() !==
    'strict-origin-when-cross-origin'
  ) {
    throw deploymentError(`${label}缺少预期Referrer-Policy。`);
  }
}

function extractHashedAsset(html) {
  const matches = html.matchAll(/(?:src|href)=["']([^"']*\/assets\/[^"']+)["']/giu);
  for (const match of matches) {
    const candidate = match[1];
    if (/\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{6,}\.(?:js|css)(?:\?|$)/u.test(candidate)) {
      return candidate;
    }
  }
  throw deploymentError('生产HTML中没有找到Vite哈希JS/CSS资源。');
}

function resolveEndpoint(baseUrl, relative) {
  const root = new URL(baseUrl.href);
  if (!root.pathname.endsWith('/')) {
    root.pathname += '/';
  }
  return new URL(relative.replace(/^\//u, ''), root);
}

async function fetchChecked(url, options) {
  const result = await requestWithTimeout(url, options);
  const { response } = result;
  const finalUrl = new URL(response.url || url.href);
  ensureNoHttpDowngrade(options.baseUrl, finalUrl);
  for (const [name, value] of url.searchParams) {
    if (finalUrl.searchParams.get(name) !== value) {
      throw deploymentError(`${url.pathname}响应丢失查询参数${name}。`);
    }
  }
  return result;
}

export async function verifyDeployment(
  input,
  {
    allowHttpLocalhost = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
    projectRoot = process.cwd(),
  } = {},
) {
  const baseUrl = validateDeploymentUrl(input, { allowHttpLocalhost });
  const requestOptions = { timeoutMs, fetchImpl, baseUrl };
  const [localAnimated, localAr] = await Promise.all([
    readFile(path.join(projectRoot, 'public/models/luban-lock.glb')),
    readFile(path.join(projectRoot, 'public/models/luban-lock-ar.glb')),
  ]);
  const checks = [];

  const pageRequests = [
    ['普通页面', '/'],
    ['AR页面', '/?mode=ar'],
    ['AR页面与UTM参数', '/?mode=ar&utm_source=deploy-check'],
  ];
  let rootHtml = '';
  for (const [label, endpoint] of pageRequests) {
    const url = resolveEndpoint(baseUrl, endpoint);
    const { response, body: responseBody } = await fetchChecked(
      url,
      requestOptions,
    );
    const body = responseBody.toString('utf8');
    verifyHtmlPayload({
      label,
      status: response.status,
      contentType: response.headers.get('content-type'),
      body,
    });
    verifyGlobalHeaders(response.headers, label);
    if (label === '普通页面') {
      rootHtml = body;
    }
    checks.push(label);
  }

  const modelChecks = [
    {
      label: '普通模型',
      endpoint: '/models/luban-lock.glb',
      local: localAnimated,
      animations: REQUIRED_ANIMATIONS,
    },
    {
      label: 'AR模型',
      endpoint: '/models/luban-lock-ar.glb',
      local: localAr,
      animations: [],
    },
  ];
  const modelReports = [];
  for (const item of modelChecks) {
    const url = resolveEndpoint(baseUrl, item.endpoint);
    const { response, body: buffer } = await fetchChecked(url, requestOptions);
    const report = verifyModelPayload({
      label: item.label,
      status: response.status,
      contentType: response.headers.get('content-type'),
      cors: response.headers.get('access-control-allow-origin'),
      cacheControl: response.headers.get('cache-control'),
      buffer,
      expectedHash: sha256(item.local),
      expectedAnimations: item.animations,
    });
    modelReports.push(report);
    checks.push(item.label);
  }

  const missingUrl = resolveEndpoint(
    baseUrl,
    '/models/__deployment-check-missing__.glb',
  );
  const { response: missingResponse, body: missingBody } = await fetchChecked(
    missingUrl,
    requestOptions,
  );
  verifyMissingModelPayload({
    status: missingResponse.status,
    contentType: missingResponse.headers.get('content-type'),
    body: missingBody.toString('utf8'),
  });
  checks.push('缺失模型404');

  const assetUrl = resolveEndpoint(baseUrl, extractHashedAsset(rootHtml));
  const { response: assetResponse } = await fetchChecked(
    assetUrl,
    requestOptions,
  );
  if (assetResponse.status !== 200) {
    throw deploymentError(`Vite哈希资源应返回200，实际为${assetResponse.status}。`);
  }
  verifyImmutableAssetCache(assetResponse.headers.get('cache-control'));
  checks.push('哈希资源缓存');

  return {
    baseUrl: baseUrl.href,
    checks,
    animatedModelHash: modelReports[0].hash,
    arModelHash: modelReports[1].hash,
    conclusion: 'HTTPS静态部署远程检查通过',
  };
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const report = await verifyDeployment(process.argv[2]);
    console.info(`远程部署地址：${report.baseUrl}`);
    for (const check of report.checks) {
      console.info(`通过：${check}`);
    }
    console.info(`普通模型SHA-256：${report.animatedModelHash}`);
    console.info(`AR模型SHA-256：${report.arModelHash}`);
    console.info(`最终结论：${report.conclusion}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
