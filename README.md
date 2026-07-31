# 六通鲁班锁手机端 3D 展示

使用 Vite、TypeScript 和 [`@google/model-viewer`](https://modelviewer.dev/) 制作的移动端优先 3D 查看页面。用户可以在手机浏览器、微信内置浏览器或桌面 Chrome 中旋转和缩放查看六通鲁班锁，无需安装 App。

## 环境要求

- Node.js 20 或更新版本
- npm 10 或更新版本
- 支持 WebGL 的现代浏览器

本项目开发时使用 Node.js 24.15.0 和 npm 11.12.1。

## 安装依赖

```bash
npm install
```

## 本地运行

```bash
npm run dev
```

Vite 会输出本地访问地址。若需要让同一局域网内的手机访问，可以运行：

```bash
npm run dev -- --host 0.0.0.0
```

## 生产构建

```bash
npm run build
```

构建文件输出到 `dist/`。

## 本地预览生产构建

```bash
npm run preview
```

## 自动化测试

```bash
npm run test
```

测试覆盖模型资源探测、加载进度、中文状态文案和减少动态偏好。

## 模型文件位置

网页固定从以下 URL 加载模型：

```text
/models/luban-lock.glb
```

对应项目文件为：

```text
public/models/luban-lock.glb
```

如果文件不存在，页面不会显示空白，而会提示：

```text
未找到模型文件，请将模型放入 public/models/luban-lock.glb
```

## 如何替换模型

1. 准备一个有效的二进制 glTF 2.0 `.glb` 文件。
2. 保留现有模型备份。
3. 将新文件命名为 `luban-lock.glb`。
4. 替换 `public/models/luban-lock.glb`。
5. 运行 `npm run build`，确认 `dist/models/luban-lock.glb` 已生成。
6. 在手机和桌面浏览器中重新检查初始视角、缩放范围和文件大小。

不要用空文件或伪造内容代替 GLB。替换模型不会要求修改 TypeScript 路径。

## 当前已完成

- 手机竖屏优先布局与桌面调试布局
- 单指旋转、双指缩放、鼠标拖动
- 默认慢速自动旋转
- 暂停和恢复自动旋转
- 恢复初始视角
- 加载进度条、百分比与弱网提示
- 模型缺失与普通加载失败的中文错误状态
- 重新加载按钮和控制台诊断信息
- 柔和阴影、木制模型环境光和缩放范围限制
- `prefers-reduced-motion` 支持
- 手机安全区域、44px 以上触摸目标和无障碍标签

## 当前尚未实现

- 拆解动画与组装动画
- AR / VR
- 自由拼装与零件拖动
- 碰撞检测
- 用户账号、后端、数据库或数据统计

模型内部保留 `Assemble` 和 `Disassemble` 动画，但本阶段页面不会播放或控制它们。

## 常见问题

### 模型加载失败

确认网络请求 `/models/luban-lock.glb` 返回 HTTP 200，而不是 404、登录页或 HTML 首页。页面的“重新加载”按钮会重新检查资源，浏览器控制台会记录失败 URL 和事件。

### 模型路径错误

模型必须位于 `public/models/luban-lock.glb`。不要放在 `src/`，也不要在文件名中加入空格或改用其他大小写。

### 手机上显示空白

- 确认手机浏览器支持 WebGL，并关闭可能禁用硬件加速的省电设置。
- 确认服务器通过 HTTP(S) 提供页面，不要直接双击 `index.html`。
- 在微信中无法显示时，先用同一手机的 Chrome 或 Safari 检查，以区分网页问题和内置浏览器限制。
- 检查浏览器控制台或远程调试中的 GLB 请求、CORS 和 WebGL 错误。

### 模型尺寸或视角不合适

当前模型整体最大尺寸为 0.075 m，页面使用相对包围盒的相机距离。如果替换模型后显示过大、过小或偏离中心，应先在 Blender 中修正模型单位、包围盒中心和地面原点，再调整 `index.html` 的 `camera-orbit`、`min-camera-orbit` 和 `max-camera-orbit`。

## 模型来源与许可

- 作者：LinLUCAS
- 模型：Lu Ban Lock 鲁班锁
- 许可：CC BY 4.0
- 原始来源：[Sketchfab](https://sketchfab.com/3d-models/lu-ban-lock-d7abd39400044c47981fe94565301aa3)

`public/models/luban-lock.glb` 是基于上述模型制作的网页优化衍生版本，不应描述为完全原创模型。结构和优化记录见 `docs/model-audit.md` 及 `outputs/validation/`。

## 下一阶段动画接入准备

在接入拆解和组装前，需要：

1. 保持动画名称精确为 `Assemble` 和 `Disassemble`。
2. 保持六个动画节点名稳定：`LB_Part_01_X_A` 至 `LB_Part_06_Z_B`。
3. 明确动画按钮、播放中断、反向切换和首尾状态规则。
4. 决定继续使用 `model-viewer` 的单动画播放接口，还是为零件级控制迁移到 Three.js。
5. 在手机上验证两段动画的帧率、内存、触摸冲突和连续点击行为。
6. 保留当前 0.075 m 尺寸、地面原点、木纹材质和 CC BY 4.0 署名。
