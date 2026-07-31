# 六通鲁班锁手机端 3D 展示网站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前目录交付可构建、可在手机浏览器查看鲁班锁 GLB 的 Vite + Vanilla TypeScript 第一版网站。

**Architecture:** `@google/model-viewer` 负责 Web 3D、相机和手势；原生 TypeScript 管理模型探测、加载状态、错误恢复和两个按钮。纯函数与资源探测分离到小模块并用 Vitest 测试，HTML 保持语义化，所有视觉规则集中在 CSS。

**Tech Stack:** Vite、TypeScript、`@google/model-viewer`、Vitest、HTML、CSS

---

### Task 1: 初始化 Vite + Vanilla TypeScript 基础结构

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/style.css`
- Create: `public/images/.gitkeep`

- [ ] **Step 1: 确认当前目录没有现有 Vite 项目**

Run:

```powershell
Test-Path package.json
Test-Path vite.config.ts
Test-Path src/main.ts
```

Expected: 三项均为 `False`。

- [ ] **Step 2: 创建最小包配置与 TypeScript 配置**

`package.json` 必须包含：

```json
{
  "name": "luban-lock-mobile-viewer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

`tsconfig.json` 使用严格模式、DOM 库、`moduleResolution: "Bundler"`、`noUnusedLocals` 和 `noUnusedParameters`。

- [ ] **Step 3: 安装运行与开发依赖**

Run:

```powershell
npm install @google/model-viewer
npm install --save-dev vite typescript vitest
```

Expected: `package-lock.json` 生成，命令退出码为 0。

- [ ] **Step 4: 创建基础入口占位文件和 images 目录标记**

`src/main.ts` 只导入样式；`src/style.css` 只写基础 box-sizing；`index.html` 提供 `#app`。这些占位内容会在后续任务通过测试后替换。

- [ ] **Step 5: 提交初始化结构**

```powershell
git add package.json package-lock.json tsconfig.json index.html src/main.ts src/style.css public/images/.gitkeep
git commit -m "chore: initialize Vite TypeScript viewer"
```

### Task 2: 用 TDD 实现加载状态与模型可用性模块

**Files:**
- Create: `tests/viewer-state.test.ts`
- Create: `tests/model-availability.test.ts`
- Create: `src/viewer-state.ts`
- Create: `src/model-availability.ts`

- [ ] **Step 1: 先写状态模块测试**

`tests/viewer-state.test.ts` 覆盖以下真实行为：

```ts
import { describe, expect, it } from 'vitest';
import {
  clampProgress,
  initialAutoRotate,
  statusCopy,
} from '../src/viewer-state';

describe('clampProgress', () => {
  it('将进度限制在 0 到 100 的整数百分比', () => {
    expect(clampProgress(-0.1)).toBe(0);
    expect(clampProgress(0.426)).toBe(43);
    expect(clampProgress(2)).toBe(100);
  });
});

describe('initialAutoRotate', () => {
  it('在减少动态时默认关闭自动旋转', () => {
    expect(initialAutoRotate(true)).toBe(false);
    expect(initialAutoRotate(false)).toBe(true);
  });
});

describe('statusCopy', () => {
  it('为缺少模型和加载失败返回明确中文信息', () => {
    expect(statusCopy('missing')).toContain('public/models/luban-lock.glb');
    expect(statusCopy('error')).toContain('3D模型加载失败');
  });
});
```

- [ ] **Step 2: 运行状态测试并确认 RED**

Run: `npm run test -- tests/viewer-state.test.ts`

Expected: FAIL，原因是 `src/viewer-state.ts` 不存在。

- [ ] **Step 3: 实现最小状态模块**

`src/viewer-state.ts` 定义：

```ts
export type ViewerStatus = 'checking' | 'loading' | 'ready' | 'missing' | 'error';

export function clampProgress(totalProgress: number): number {
  return Math.round(Math.min(1, Math.max(0, totalProgress)) * 100);
}

export function initialAutoRotate(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion;
}

export function statusCopy(status: ViewerStatus): string {
  const copy: Record<ViewerStatus, string> = {
    checking: '正在检查3D模型……',
    loading: '正在加载3D模型……',
    ready: '3D模型已加载',
    missing: '未找到模型文件，请将模型放入 public/models/luban-lock.glb',
    error: '3D模型加载失败，请检查网络后重试。',
  };
  return copy[status];
}
```

- [ ] **Step 4: 运行状态测试并确认 GREEN**

Run: `npm run test -- tests/viewer-state.test.ts`

Expected: PASS。

- [ ] **Step 5: 先写模型探测测试**

`tests/model-availability.test.ts` 使用一个返回真实 `Response` 的轻量 fetcher，覆盖：200 GLB 为 available、404 为 missing、200 HTML 回退页为 missing、网络异常为 error。

- [ ] **Step 6: 运行模型探测测试并确认 RED**

Run: `npm run test -- tests/model-availability.test.ts`

Expected: FAIL，原因是 `src/model-availability.ts` 不存在。

- [ ] **Step 7: 实现模型探测**

`src/model-availability.ts` 导出：

```ts
export type ModelAvailability = 'available' | 'missing' | 'error';
export type FetchModel = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function checkModelAvailability(
  url: string,
  fetchModel: FetchModel = fetch,
): Promise<ModelAvailability> {
  try {
    const response = await fetchModel(url, { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) return response.status === 404 ? 'missing' : 'error';
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    return contentType.includes('text/html') ? 'missing' : 'available';
  } catch {
    return 'error';
  }
}
```

- [ ] **Step 8: 运行全部测试并提交**

Run: `npm run test`

Expected: 全部 PASS。

```powershell
git add src/viewer-state.ts src/model-availability.ts tests
git commit -m "test: add viewer loading state behavior"
```

### Task 3: 实现语义化页面与 model-viewer 交互

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`

- [ ] **Step 1: 写完整语义化 HTML**

`index.html` 包含 viewport-fit、中文标题、description、标题区、`model-viewer`、加载进度层、错误层、控制按钮和底部说明。关键元素 ID 固定为：

```text
lubanViewer, loadingPanel, progressBar, progressFill, progressText,
statusMessage, errorPanel, errorMessage, retryButton, controls,
rotationButton, resetViewButton
```

`model-viewer` 必须设置：

```html
alt="六通鲁班锁3D模型"
camera-controls
camera-orbit="35deg 68deg 115%"
min-camera-orbit="auto auto 75%"
max-camera-orbit="auto auto 170%"
shadow-intensity="0.8"
shadow-softness="0.9"
environment-image="neutral"
```

HTML 不设置 `src`，由 TypeScript 在探测成功后添加。

- [ ] **Step 2: 实现 TypeScript 控制器**

`src/main.ts`：

1. 导入 `@google/model-viewer` 和样式。
2. 用泛型 `requireElement<T>()` 对所有 DOM 查询做空值检查。
3. 根据 `prefers-reduced-motion` 设置初始自动旋转。
4. `renderStatus()` 管理 checking/loading/ready/missing/error 五种互斥状态。
5. 监听 `progress`、`load`、`error`。
6. 切换按钮修改 `auto-rotate` 属性和按钮文案。
7. 恢复按钮重设 `cameraOrbit`、`fieldOfView`，调用 `resetTurntableRotation()` 和 `jumpCameraToGoal()`。
8. 重试先探测资源，再用时间戳查询参数重设 `src`。
9. 错误事件使用 `console.error` 输出 URL 与事件，不使用 `any`。

- [ ] **Step 3: 实现移动端优先 CSS**

`src/style.css` 包含：

- `100vh` 回退与 `100dvh`；
- `env(safe-area-inset-top)`、`env(safe-area-inset-bottom)`；
- 无横向滚动；
- 3D 区域使用 `minmax(0, 1fr)` 占据主要空间；
- 48px 以上按钮、`touch-action: manipulation`；
- 模型交互区合适的 `touch-action`；
- 木色、米白与深棕视觉系统；
- 加载进度过渡、错误卡片和 ready 淡出；
- 桌面最大宽度与手机窄屏断点；
- `prefers-reduced-motion` 中关闭过渡和动画。

- [ ] **Step 4: 运行类型检查、测试和构建**

Run:

```powershell
npm run test
npm run build
```

Expected: 两个命令退出码为 0，无 TypeScript 错误。

- [ ] **Step 5: 提交页面实现**

```powershell
git add index.html src/main.ts src/style.css
git commit -m "feat: build mobile Luban lock viewer"
```

### Task 4: 放置已验证模型并完善 README

**Files:**
- Create: `public/models/luban-lock.glb`
- Create: `README.md`

- [ ] **Step 1: 验证来源模型并复制网页副本**

Run:

```powershell
Get-FileHash -Algorithm SHA256 outputs/lu_ban_lock_mobile_ar.glb
New-Item -ItemType Directory -Force public/models
Copy-Item -LiteralPath outputs/lu_ban_lock_mobile_ar.glb -Destination public/models/luban-lock.glb
Get-FileHash -Algorithm SHA256 public/models/luban-lock.glb
```

Expected: 两个 SHA-256 完全一致；原始 Downloads 模型未被写入。

- [ ] **Step 2: 编写 README**

README 必须覆盖用途、Node/npm 环境、`npm install`、dev/build/preview、模型固定路径、替换方式、已完成功能、未实现的动画/AR/自由拼装，以及以下排错项：加载失败、路径错误、手机空白、尺寸或视角不合适。

README 同时记录来源：LinLUCAS、Lu Ban Lock 鲁班锁、CC BY 4.0、原始 Sketchfab URL，并说明网页副本是优化衍生模型。

- [ ] **Step 3: 再次构建并检查 dist 模型**

Run:

```powershell
npm run build
Get-Item public/models/luban-lock.glb, dist/models/luban-lock.glb
```

Expected: 两个 GLB 均非空且大小相同。

### Task 5: 浏览器验收与最终核验

**Files:**
- Verify: all project files
- Verify: `public/models/luban-lock.glb`

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite 给出本地 URL，首页 HTTP 200。

- [ ] **Step 2: 桌面浏览器检查**

检查标题、模型加载、进度层消失、自动旋转按钮、恢复按钮、控制台错误与 GLB 请求状态。

- [ ] **Step 3: 手机尺寸检查**

在约 390×844 视口检查：无横向溢出、3D 区域占主要空间、安全区域留白、按钮触摸尺寸不小于 44px、底部说明可读。

- [ ] **Step 4: 检查错误与 missing 状态**

在浏览器上下文临时调用模型探测函数的缺失路径场景，或拦截模型请求返回 404，确认显示：

```text
未找到模型文件，请将模型放入 public/models/luban-lock.glb
```

再模拟普通加载错误，确认显示：

```text
3D模型加载失败，请检查网络后重试。
```

不移动、不删除正式 GLB。

- [ ] **Step 5: 新鲜运行最终验证**

Run:

```powershell
npm install
npm run test
npm run build
Get-FileHash -Algorithm SHA256 C:\Users\Ocean\Downloads\lu_ban_lock.glb
git status --short
```

Expected: 安装、测试和构建退出码为 0；源 SHA-256 仍为 `8E215A86264DAFC2A3A9CF43406E2DB2470EEF0A150264DB91E98EB8BD655A5B`。

