# 六通鲁班锁 Cloudflare Pages 部署手册

## 当前状态与部署架构

当前项目已完成本地Cloudflare Pages部署准备，但尚未创建GitHub远程仓库、Cloudflare Pages项目或真实公网地址。部署架构固定为：

```text
GitHub生产分支
→ Cloudflare Pages Git integration
→ npm安装依赖
→ npm run deploy:check
→ 发布dist/
→ HTTPS pages.dev地址
```

网站保持纯静态Vite架构，只发布HTML、哈希JS/CSS和两个GLB。没有Pages Functions、Worker、SSR、后端API、数据库或对象存储迁移。

选择Git集成是因为项目会继续迭代：生产分支推送可触发生产部署，其他分支可产生预览部署，并且构建日志与提交版本可追踪。Direct Upload和拖拽上传无法提供同样清晰的Git版本来源，因此本项目不采用；也不安装Wrangler或创建Direct Upload类型项目。

## 受保护模型基线

| 文件 | 用途 | SHA-256 | 大小 |
|---|---|---|---:|
| `public/models/luban-lock.glb` | 普通3D拆装 | `854590B5A6AE2C54CB560D7FDF22A4CD249BB0339323CB68DA7DC64915FB180D` | 2,487,052 bytes |
| `public/models/luban-lock-ar.glb` | 静态完整组装AR | `06EC186E114F4B77BF38A39DF83A4C11AF1B5E3CF4BDFD606CEE3A6E615DF4EB` | 2,484,792 bytes |

普通模型必须保留名称区分大小写的 `Assemble` 和 `Disassemble`，AR模型必须为0个动画。二者最大尺寸均约0.075米。模型文件直接进入Git仓库，不使用Git LFS。

## 本地部署检查

安装依赖并执行完整检查：

```bash
npm install
npm run deploy:check
npx tsc --noEmit
```

也可以分开执行：

```bash
npm run model:ar
npm run test
npm run build
npm run deploy:dist
```

`prebuild` 会在每次生产构建前执行 `npm run model:ar`。生成器读取原动画GLB并重新生成静态AR衍生文件；若原模型缺失、动画名称错误或结构验证失败，构建会失败。

`scripts/verify-dist.mjs` 会检查：

- `dist/index.html`、顶层 `dist/404.html`、`dist/assets/`、`dist/_headers` 和两个模型存在；
- public、dist与受保护基线的模型哈希一致；
- GLB 2.0头、文件大小、动画名称/数量和约0.075米静态尺寸正确；
- 单文件小于25MiB，模型不是HTML占位页；
- 模型URL仍为 `/models/luban-lock.glb` 和 `/models/luban-lock-ar.glb`；
- `_headers` 的MIME、CORS和缓存规则正确；
- 没有危险SPA回退、Functions、`_worker.js`、环境文件、Token、私钥、本机路径或本地服务器地址。

## 静态响应头

`public/_headers` 会被Vite原样复制到 `dist/_headers`：

```text
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/models/*.glb
  Content-Type: model/gltf-binary
  Content-Disposition: inline
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=3600, must-revalidate
```

GLB使用稳定文件名，所以只缓存一小时并要求重新验证；Vite哈希JS/CSS可以安全使用一年immutable缓存。只对模型目录开放CORS，方便Scene Viewer、Quick Look等外部查看器直接获取模型。HTML没有长期immutable缓存。

当前不设置HSTS、严格CSP、COOP、COEP或 `Cross-Origin-Resource-Policy: same-origin`，也不添加会禁止camera或xr-spatial-tracking的策略，避免在域名和真机AR尚未稳定前破坏WebXR与原生查看器。

## 为什么没有SPA catch-all

应用只有 `/` 与 `/?mode=ar`，模式由查询参数决定，不存在需要客户端路径回退的路由。因此不创建 `public/_redirects`，尤其禁止：

```text
/* /index.html 200
```

`model-availability` 依赖模型请求的真实404。若缺失GLB被重写成HTTP 200的HTML首页，普通页面会收到错误格式，外部AR查看器也可能下载HTML。部署后 `/models/__deployment-check-missing__.glb` 必须返回404。

Cloudflare Pages在没有顶层 `404.html` 时会默认按SPA处理并把未知路径交给根页面，所以项目提供 `public/404.html`，由Vite复制为 `dist/404.html`。它只负责保证未知资源得到真实404，不是catch-all重写。

## GitHub仓库准备与授权边界

提交前检查：

```bash
git status
git branch --show-current
git remote -v
```

确认 `.gitignore` 排除 `node_modules/`、`dist/`、日志、环境文件、`.dev.vars` 和 `.wrangler/`，但不排除 `public/models/`、`public/_headers`、`scripts/`、`tests/`、`src/` 与 `docs/`。提交前再次执行 `npm run deploy:check`，检查差异和秘密扫描结果。

以下信息必须由用户提供或确认：

```text
GitHub仓库：<GitHub仓库URL>
仓库可见性：public / private
生产分支：<确认后的生产分支>
是否允许Git提交：等待用户明确授权
是否允许Git推送：等待用户明确授权
```

不得在没有明确授权时初始化/重命名分支、修改远程、提交或推送。禁止强制推送、删除远程分支、重写历史或把Token写入项目。

## Cloudflare Pages控制台配置

在Cloudflare控制台选择 **Workers & Pages → Create → Pages → Connect to Git**，Git提供商选择GitHub。不要选择Direct Upload。

| 配置项 | 值 |
|---|---|
| GitHub仓库 | `<GitHub仓库URL>` |
| Cloudflare项目名 | `<Cloudflare项目名>` |
| 生产分支 | `<确认后的生产分支>` |
| 根目录 | 留空，使用仓库根目录 |
| 构建命令 | `npm run deploy:check` |
| 构建输出目录 | `dist` |
| Node版本 | 根目录 `.node-version` 中的 `24.15.0` |
| 环境变量 | 不需要 |
| Pages Functions | 不使用 |

用户必须亲自在GitHub/Cloudflare完成登录、OAuth授权、仓库选择和Pages项目创建。正式页面与两个模型URL必须公开，不得用Cloudflare Access要求登录、Cookie、Token、Referer或特殊请求头。可以单独保护预览分支，但不能保护生产模型URL。

## 首次构建日志检查

构建日志应显示：

1. npm依赖安装成功；
2. Node版本为24.15.0；
3. `npm run deploy:check` 启动；
4. 全部Vitest测试通过；
5. `prebuild` 成功生成并验证静态AR模型；
6. TypeScript与Vite生产构建成功；
7. `dist`验证输出文件数、总大小、模型哈希和响应头结果；
8. Cloudflare资源上传成功。

`model-viewer` chunk size warning允许存在，不是失败条件。若构建失败，先读取日志中的第一个根本错误；不要升级依赖、删除测试、绕过哈希、加入 `exit 0`，或把失败构建描述为成功。

## pages.dev首次验证

首次发布先使用：

```text
生产首页：<pages.dev生产地址>/
AR页面：<pages.dev生产地址>/?mode=ar
普通模型：<pages.dev生产地址>/models/luban-lock.glb
AR模型：<pages.dev生产地址>/models/luban-lock-ar.glb
```

不要在验证前绑定自定义域名或生成二维码。执行：

```bash
npm run deploy:verify -- <pages.dev生产地址>
```

`scripts/verify-deployment.mjs` 会验证：

- 基础URL为HTTPS，网络/DNS/TLS请求有明确超时；
- `/`、`/?mode=ar` 和带UTM的AR查询页面返回200 HTML和项目标题；
- 响应没有降级到HTTP或泄漏本机路径；
- 两个模型返回200、`model/gltf-binary`、`Access-Control-Allow-Origin: *` 和适中缓存；
- 线上模型SHA-256与本地一致，普通模型动画正确，AR模型为0动画；
- 保证不存在的模型路径返回真实404；
- 全局安全头存在，Vite哈希资源使用一年immutable缓存。

远程验证脚本不存储账号密码或Token。没有真实地址时不得使用占位符运行并宣称远程验证通过。

## 桌面浏览器验证

在真实HTTPS地址检查普通模式：只请求动画模型，完成拆解、暂停、继续、重置、重新组装、自动旋转偏好和恢复视角；控制台无未处理错误。

检查AR模式：只请求静态AR模型，不播放动画，动画控件隐藏，AR说明、返回按钮和静态旋转缩放正常。桌面 `canActivateAR=false` 是合理降级，不代表手机AR失败。

至少检查320×568、375×667、390×844、430×932和桌面宽屏，确认无横向溢出、3D区域未塌陷、按钮触摸高度不低于48px、署名可见，网络延迟或GLB失败时仍有中文状态与重试入口。

## 真机验证边界

Cloudflare发布与桌面设备模拟都不能证明以下项目通过：iOS Safari Quick Look、Android Chrome WebXR、Android Scene Viewer、微信内置浏览器、摄像头权限、ARCore、水平面识别、真实75毫米比例、真机GPU/内存、多点触控和外部查看器后台返回。按 [`AR-TEST.md`](AR-TEST.md) 在真实设备上记录结果。

## 自定义域名（可选后续阶段）

只有pages.dev验证完成且用户明确提供目标域名、DNS服务商、Cloudflare接入状态并授权修改DNS后才继续：

1. 先在Pages项目的Custom domains中添加 `<自定义域名>`；
2. 再按Cloudflare提示配置DNS，并记录修改前原值；
3. 等待证书与域名状态有效；
4. 用HTTPS新域名重新运行远程验证并检查两个GLB；
5. 保留pages.dev地址，不立即设置强制重定向或HSTS。

不要只手工创建CNAME而不先关联Pages项目。验证稳定前不把临时地址印到包装，也不创建正式二维码。

## 部署失败排查

- **Node不一致**：检查构建日志是否读取根目录 `.node-version`。
- **安装失败**：确认没有手工修改依赖树或删除 `package-lock.json`。
- **AR生成失败**：检查原模型存在、哈希未变且动画精确为 `Assemble`、`Disassemble`。
- **dist验证失败**：按脚本指出的文件与原因修复，不绕过检查。
- **模型404**：确认两个模型进入Git仓库、构建日志成功复制到 `dist/models/`。
- **模型MIME/CORS错误**：确认 `dist/_headers` 存在并查看线上响应头。
- **错误200回退**：删除危险catch-all，确认缺失模型真实返回404。
- **旧模型缓存**：比较线上和本地SHA-256；必要时等待一小时缓存或在Cloudflare清除对应模型URL缓存，然后重新验证，不靠页面外观猜测。
- **输出目录错误**：Pages应发布 `dist`，根目录留空。

Cloudflare控制台的部署详情页包含每次Git提交对应的构建日志与资源上传结果。生产分支应同时在GitHub默认/目标分支和Pages设置中核对；不要仅凭项目名推断。

## 更新模型后的部署流程

模型更新必须经过单独的模型审计和明确授权。更新原模型后重新运行 `npm run model:ar`，记录新的两份哈希、动画与0.075米尺寸，更新受保护基线和测试，再执行 `npm run deploy:check`、提交到确认分支并由Git集成部署。线上用 `npm run deploy:verify` 比较远程哈希，确认不是旧缓存。

当前仍未实现AR中的拆装动画、自由拼装、零件拖动、碰撞检测和VR头显模式；Cloudflare部署不会改变这些产品边界。
