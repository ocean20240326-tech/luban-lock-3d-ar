# 六通鲁班锁手机端 3D 展示

使用 Vite、TypeScript 和 [`@google/model-viewer`](https://modelviewer.dev/) 制作的移动端优先 3D/AR 查看页面。普通模式可以旋转、缩放查看六通鲁班锁并播放模型内置的拆解与重新组装动画；AR模式使用独立的静态组装模型，供支持设备尝试按真实尺寸放到水平桌面上。

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

构建前会自动执行静态AR模型生成。也可以单独运行：

```bash
npm run model:ar
```

用于Cloudflare Pages生产构建的完整本地检查为：

```bash
npm run deploy:check
```

该命令依次执行全部测试、生产构建和 `dist/` 部署审计；不会提交Git、推送仓库或创建Cloudflare项目。

## 本地预览生产构建

```bash
npm run preview
```

## 自动化测试

```bash
npm run test
```

测试覆盖模型资源探测、加载进度、中文状态文案、减少动态偏好、动画状态转换、按钮状态表、播放令牌、进度钳制、暂停/继续、重置、无效时长和拆装区无障碍标记。

## 生产部署（准备完成，尚未上线）

项目保持纯静态Vite架构，生产方案是 **GitHub + Cloudflare Pages Git integration**：生产分支推送后由Cloudflare安装依赖，执行 `npm run deploy:check`，并发布 `dist/`。不使用Direct Upload、Wrangler、Pages Functions、Worker、后端或数据库。

Cloudflare Pages控制台配置：

```text
部署类型：Pages / Connect to Git
Git提供商：GitHub
生产分支：main
根目录：留空（仓库根目录）
构建命令：npm run deploy:check
构建输出目录：dist
Node版本：由 .node-version 固定为 24.15.0
环境变量：不需要
```

当前生产站点已通过Cloudflare Pages Git集成发布，并完成自动远程检查与桌面浏览器验证：

```text
GitHub：https://github.com/ocean20240326-tech/luban-lock-3d-ar
普通模式：https://luban-lock-3d-ar.pages.dev/
AR模式：https://luban-lock-3d-ar.pages.dev/?mode=ar
普通模型：https://luban-lock-3d-ar.pages.dev/models/luban-lock.glb
AR模型：https://luban-lock-3d-ar.pages.dev/models/luban-lock-ar.glb
```

重新部署后运行：

```bash
npm run deploy:verify -- https://luban-lock-3d-ar.pages.dev
```

`public/_headers` 为GLB设置 `model/gltf-binary`、跨源读取和适中缓存，为Vite哈希资源设置一年 `immutable` 缓存。没有添加SPA catch-all或 `_redirects`，并提供顶层 `public/404.html` 关闭Cloudflare Pages的默认SPA回退；模型缺失必须保持真实404，不能回退成HTML首页。

完整的GitHub准备、Cloudflare配置、构建日志检查、远程验证和自定义域名步骤见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。在真实HTTPS地址、手机AR和稳定域名全部验证前，不生成正式二维码。

## 模型文件位置

普通3D模式从以下 URL 加载带动画模型：

```text
/models/luban-lock.glb
```

对应项目文件为：

```text
public/models/luban-lock.glb
```

AR模式从以下 URL 加载自动生成的静态模型：

```text
/models/luban-lock-ar.glb
```

对应项目文件为 `public/models/luban-lock-ar.glb`。不要手工编辑该文件；运行 `npm run model:ar` 从原模型重新生成。

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
- 单次播放内置 `Disassemble` 拆解动画
- 单次播放内置 `Assemble` 组装动画
- 拆装动画暂停和从当前进度继续
- 从任意可用动画状态重置到完整组装状态
- 动画真实进度、状态文案和按钮状态表
- 动画期间暂停自动旋转并在结束或重置后恢复用户偏好
- 加载进度条、百分比与弱网提示
- 模型缺失与普通加载失败的中文错误状态
- 重新加载按钮和控制台诊断信息
- 柔和阴影、木制模型环境光和缩放范围限制
- `prefers-reduced-motion` 支持
- 手机安全区域、48px 以上触摸目标和无障碍标签
- `?mode=ar` 独立AR预览模式
- 自动生成不含动画的静态AR GLB
- WebXR、Android Scene Viewer 和 iOS Quick Look 后端配置
- `canActivateAR` 支持检测、`ar-status` 状态提示和失败降级
- `ar-scale="fixed"` 真实比例与 `ar-placement="floor"` 水平面放置
- Cloudflare Pages Git集成所需的Node版本、响应头、构建审计和远程验证脚本

## 当前尚未实现

- AR中的拆装动画
- 自由拼装与零件拖动
- 碰撞检测
- VR头显模式
- 用户账号、后端、数据库或数据统计

当前拆装功能按预制动画演示固定步骤，不支持用户任意选择、拖动或碰撞拼装零件。

## 拆装演示

模型包含两个名称区分大小写的动画 clip：

```text
Assemble
Disassemble
```

- “拆解演示”仅在完整组装状态可用。它从 `Disassemble` 的第 0 秒开始，只播放一轮，结束后停在六个零件完全拆开的姿态。
- “重新组装”仅在完全拆开状态可用。它从 `Assemble` 的第 0 秒开始，只播放一轮，结束后停在完整组装姿态。
- 播放中可点击“暂停动画”。暂停会保留当前动画名和真实 `currentTime`；“继续动画”使用 `play({ repetitions: 1 })` 从当前位置完成本轮，不会改成无限循环。
- “重置模型”不会刷新页面、重新下载 GLB 或播放整段组装动画。它暂停动画，选择 `Disassemble`，等待组件更新后直接回到第 0 秒组装姿态。
- 拆装播放期间暂时关闭自动旋转并禁用自动旋转按钮；完成或重置后恢复用户开始播放前的偏好。手动旋转和缩放保持可用。

### 动画状态机

加载状态与动画状态相互独立。动画状态使用单一联合类型，而不是多组可能冲突的布尔值：

```text
initializing → assembled

assembled
  → playing-disassemble
  ↔ paused-disassemble
  → disassembled

disassembled
  → playing-assemble
  ↔ paused-assemble
  → assembled
```

动画列表不完整时进入 `unavailable`，运行异常时进入 `animation-error`。播放、重置和模型重新加载都会递增 generation；只有 generation、播放状态、动画名称、模型身份和末帧位置同时匹配的完成信号才会改变最终状态，因此过期的 `finished` 事件不能覆盖新操作。

### 为什么直接使用两个内置动画

`Disassemble` 的首帧是完整组装、末帧是完全拆开；`Assemble` 的首帧是完全拆开、末帧是完整组装。两段 clip 已包含设计好的顺序、间距和节奏，因此页面分别正向播放它们：

- 不使用 `timeScale = -1` 反向播放，避免反向完成事件、端点和暂停恢复语义变复杂。
- 不通过 Scene Graph API 或 JavaScript 手动移动六个节点，避免复制模型动画数据、破坏节点层级或产生浏览器间姿态差异。
- 不要求模型只有 6 个 Mesh；动画按精确 clip 名称工作，当前 22 个 Mesh 分属六个逻辑零件父节点。

`model-viewer` 设置了：

```html
animation-crossfade-duration="0"
```

`Disassemble` 末帧与 `Assemble` 首帧相同，反方向端点也相同，所以切换时无需姿态混合。关闭交叉淡化可避免两个 clip 之间短暂出现中间姿态或视觉跳动。页面没有 `autoplay`，首次加载只把 `Disassemble` 定位到第 0 秒并保持暂停。

## 手机AR查看

普通3D拆装模式地址：

```text
/
```

AR预览模式地址：

```text
/?mode=ar
```

普通模式的“手机AR查看”按钮会导航到同一页面的AR模式。URL中的UTM等无关参数会保留；返回按钮不依赖浏览器历史记录。两个模式复用同一个 `model-viewer`，HTML初始不设置 `src`，TypeScript确认模式后才设置对应模型，因此不会先下载动画模型再切换，也不会同时下载两个约2.5 MB的GLB。

### 为什么AR使用独立静态模型

`public/models/luban-lock.glb` 包含名称区分大小写的 `Assemble` 和 `Disassemble`。网页控制器可以精确选择动画，但外部原生查看器不会保留网页动画状态机；Android Scene Viewer还可能选择并循环模型中的某段动画。为保证第一版AR稳定展示完整组装状态，`scripts/create-static-ar-glb.mjs` 只删除顶层 `animations` 定义，保留默认组装姿态、节点、Mesh、材质、贴图、尺寸、场景、根节点和全部非JSON chunk原始字节。

生成脚本不会修改原模型，也不会清理已经不再引用的动画Accessor/BIN数据，避免高风险的prune、压缩、量化或重新导出。构建的 `prebuild` 会自动重新生成并验证静态AR模型。

### AR后端与尺寸

AR模式设置：

```html
ar
ar-modes="webxr scene-viewer quick-look"
ar-scale="fixed"
ar-placement="floor"
```

- WebXR主要面向支持的Android浏览器。
- Scene Viewer是Android可用的外部原生查看器路径。
- Quick Look用于iPhone和iPad；本阶段不提供未经真机验证的 `ios-src`，由 `model-viewer` 基于静态GLB动态生成USDZ。
- `ar-scale="fixed"` 保持GLB内约0.075米的真实尺寸，避免把7.5厘米鲁班锁误缩放成大型物体。
- `ar-placement="floor"` 表示放在桌面或地面等水平平面；代码不再设置额外 `scale`。

AR目前只展示完整组装状态，不播放拆装动画，也不是VR头显功能。静态AR衍生模型继续使用原模型的CC BY 4.0许可和署名。

### 支持检测、HTTPS与降级

AR模型加载并等待 `updateComplete` 后，页面先检查安全上下文，再以 `modelViewer.canActivateAR` 判断WebXR、Scene Viewer或Quick Look中是否存在可用路径，不把 `navigator.xr` 或UA字符串当作最终依据。设备不支持、权限被拒绝或启动失败时，静态3D预览仍可旋转缩放，并始终提供“返回3D拆装”。

正式AR必须通过可访问模型资源的HTTPS地址在真机测试。桌面 `http://127.0.0.1` 只适合验证页面、模型和降级UI，局域网HTTP地址通常也不能作为WebXR正式测试结果。完整步骤见 [`docs/AR-TEST.md`](docs/AR-TEST.md)。

当前 `pages.dev` 生产地址已经通过页面、模型哈希、MIME、CORS、缓存、404和桌面浏览器验证；尚未绑定自定义域名。Cloudflare部署成功仍不能替代iOS Safari、Android WebXR/Scene Viewer、微信、摄像头、平面识别和真实75毫米比例的真机验收。

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

### 动画按钮全部禁用

在浏览器控制台检查开发环境输出：

```text
model-viewer availableAnimations: Assemble, Disassemble
```

名称区分大小写，必须精确为 `Assemble` 和 `Disassemble`，不能按数组下标或“第一个动画”推断。若缺少任意一个，页面会显示“当前模型未包含完整的拆解与组装动画。”并禁用全部动画按钮，但普通 3D 查看、自动旋转和恢复视角仍可使用；控制台同时记录实际列表、缺少的名称和模型路径。

开发服务器可用以下地址验证降级界面，不会修改 GLB：

```text
/?simulate-missing-animation=Assemble
```

### AR按钮不可用

- 页面提示“AR需要通过HTTPS网页运行”时，请使用正式HTTPS部署地址。
- iPhone或iPad建议用Safari；Android建议用Chrome，并确认Google Play Services for AR可用。
- 微信内置浏览器无法启动时，点击右上角并选择“在浏览器打开”；这不代表微信一定支持AR。
- 若提示缺少AR模型，运行 `npm run model:ar`，再重新构建或启动开发服务器。
- AR失败不会影响普通3D模式，可点击“返回3D拆装”。

## 模型来源与许可

- 作者：LinLUCAS
- 模型：Lu Ban Lock 鲁班锁
- 许可：CC BY 4.0
- 原始来源：[Sketchfab](https://sketchfab.com/3d-models/lu-ban-lock-d7abd39400044c47981fe94565301aa3)

`public/models/luban-lock.glb` 是基于上述模型制作的网页优化衍生版本，不应描述为完全原创模型。结构和优化记录见 `docs/model-audit.md`；本机生成的 `outputs/` 验证与Blender产物不进入生产Git仓库。

## 后续阶段

后续阶段需要：

1. 继续保持动画名称精确为 `Assemble` 和 `Disassemble`。
2. 继续保持六个动画节点名稳定：`LB_Part_01_X_A` 至 `LB_Part_06_Z_B`。
3. 若开发自由拼装，再评估零件拾取、拖动约束、碰撞检测和吸附规则；不要把当前固定演示错误描述为自由拼装。
4. 若开发AR中的拆装动画，需另行定义各原生查看器一致的播放能力，不能直接假设网页状态机可移植。
5. 在HTTPS地址、iOS Safari、Android Chrome/Scene Viewer和微信内置浏览器继续验证权限、平面识别、帧率、内存与后台返回。
6. 保留当前0.075 m尺寸、地面原点、木纹材质和CC BY 4.0署名。
