# 六通鲁班锁手机端 3D 展示网站设计

状态：用户规格已批准，按 2026-08-01 的实现请求直接执行。

## 目标与范围

第一版提供一个无需 App、无需账号的移动端 3D 查看页面。用户通过二维码进入后，可以查看六通鲁班锁、单指旋转、双指缩放、暂停或恢复自动旋转，并恢复初始视角。

本阶段明确不实现拆解动画、组装动画、自由拼装、碰撞检测、AR、VR、统计或后端功能。GLB 中即使保留 `Assemble` 和 `Disassemble` 动画，前端也不播放或控制它们。

## 已确认的模型条件

- 审计报告：`docs/model-audit.md`。
- 网页使用已经验证的优化模型 `outputs/lu_ban_lock_mobile_ar.glb` 的副本。
- 项目路径固定为 `public/models/luban-lock.glb`，网页 URL 固定为 `/models/luban-lock.glb`。
- 优化模型为 22 个 Mesh、264 个三角形，六个稳定零件节点，最大尺寸 0.075 m。
- 模型含 `Assemble`、`Disassemble`，但第一版不调用。
- 模型使用 1K 木纹 Base Color、Normal GL 与 Roughness，文件约 2.37 MiB。
- 原始 `C:\Users\Ocean\Downloads\lu_ban_lock.glb` 只读，不修改、不覆盖。
- 公开使用时保留 LinLUCAS、Lu Ban Lock 鲁班锁、CC BY 4.0、原始 Sketchfab 来源的署名说明。

## 技术方案选择

### 采用：`@google/model-viewer` + Vite + Vanilla TypeScript

这是需求指定且最轻量的方案。`model-viewer` 负责 WebGL、触摸手势、相机、自动旋转、阴影和环境光；TypeScript 只管理加载状态、按钮状态、模型探测和错误恢复。

### 未采用：直接使用 Three.js

Three.js 能提供更多底层控制，但第一版没有动画编排、零件命中或 AR 需求。自行实现相机、触摸、加载进度和资源释放会增加代码与测试范围。

### 未采用：React/Vue 组件方案

页面状态简单，不需要框架运行时。使用原生 DOM、语义化 HTML 和小型纯函数模块即可保持可维护性。

## 页面结构

页面是移动端优先的单屏布局：

1. 顶部标题区：主标题“六通鲁班锁”，副标题“用手指旋转、缩放查看模型”。
2. 主展示区：木色渐变背景中的 `model-viewer`，占据主要可用高度。
3. 状态层：加载、缺少模型、加载错误三种互斥状态；不会出现空白页。
4. 控制区：就绪后显示“暂停旋转/自动旋转”和“恢复初始视角”。
5. 底部说明：“单指旋转，双指缩放”和“无需下载App”，附模型来源署名。

页面使用 `100dvh`，同时提供 `100vh` 回退；顶部和底部使用安全区域变量。桌面端使用居中的最大宽度容器，手机端使用接近全宽的展示卡片。

## 3D 展示配置

- `camera-controls` 开启旋转、缩放和鼠标拖动。
- 初始相机为略高的三分之四观察角度，使用相对模型包围盒的相机距离。
- 使用 `min-camera-orbit` 与 `max-camera-orbit` 限制缩放范围。
- 使用柔和阴影、neutral 环境图、适中的曝光和木制模型友好的背景。
- 默认开启慢速自动旋转；系统启用 `prefers-reduced-motion` 时默认关闭。
- 恢复视角同时重置相机轨道、视野和转台旋转量。
- 第一版不调用 `animation-name`、`play()` 或动画控制 API。

## 状态与数据流

加载状态为 `checking → loading → ready | missing | error`：

1. 启动时先对 `/models/luban-lock.glb` 做轻量可用性检查。
2. 若响应缺失或返回 HTML 回退页，进入 `missing`，显示指定路径提示。
3. 文件存在后才给 `model-viewer` 设置 `src`，避免缺失资源时出现空白。
4. `progress` 事件更新进度条、百分比和 `aria-valuenow`。
5. `load` 事件将进度置为 100%，短暂过渡后隐藏加载层并显示控制区。
6. `error` 事件进入中文错误状态并在控制台输出事件与 URL。
7. “重新加载”重新探测资源并使用带查询参数的 URL 触发加载。

## 可访问性与移动端约束

- `model-viewer` 的 alt 固定为“六通鲁班锁3D模型”。
- 按钮全部使用 `button`，最小触摸高度 48px，含明确 `aria-label`。
- 状态区域使用 `aria-live="polite"`；加载条使用 `role="progressbar"`。
- 禁止按钮文本选择和双击缩放触发；交互区采用适合模型手势的 touch-action。
- 字号不低于可读范围，页面无横向溢出。
- 减少动态偏好同时关闭自动旋转和非必要 CSS 动画。

## 测试策略

- 使用 Vitest 测试不依赖浏览器的状态函数、进度归一化、自动旋转偏好和模型可用性判断。
- 按 TDD 先看到测试因模块缺失而失败，再写实现。
- 运行 `npm run test`、`npm run build`。
- 启动 Vite 开发服务器后，用浏览器检查桌面与手机视口、实际模型加载、进度/控制按钮、恢复视角、无横向溢出。
- 临时将模型请求切换到不存在路径以检查中文 missing/error 状态；不删除正式模型文件。

## 文件职责

- `index.html`：语义化页面结构、meta 和 `model-viewer` 属性。
- `src/main.ts`：注册组件、DOM 检查、状态渲染、加载事件和按钮行为。
- `src/viewer-state.ts`：可测试的进度、运动偏好和状态文案纯函数。
- `src/model-availability.ts`：模型 URL 的轻量探测与 HTML 回退识别。
- `src/style.css`：全部布局、响应式、安全区域和状态样式。
- `tests/*.test.ts`：核心状态和资源探测行为测试。
- `README.md`：运行、替换模型、现状、排错和下一阶段准备。

