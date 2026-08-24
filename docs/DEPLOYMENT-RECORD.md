# 六通鲁班锁部署记录

> 生产HTTPS静态站点已完成远程与桌面浏览器验证。没有实际设备证据的真机字段继续标记为“尚未验证”。

| 字段 | 记录 |
|---|---|
| 部署平台 | Cloudflare Pages |
| 部署方式 | GitHub Git integration |
| GitHub仓库 | `https://github.com/ocean20240326-tech/luban-lock-3d-ar` |
| 生产分支 | `main` |
| 生产提交SHA | `d62b86320bb4b6e9ae0e7ec8d787a25719bccf0a`（应用代码验收基准；后续仅文档提交不改变dist功能） |
| Cloudflare项目名 | `luban-lock-3d-ar` |
| pages.dev地址 | `https://luban-lock-3d-ar.pages.dev/` |
| 自定义域名 | 尚未绑定 |
| 部署时间 | 2026-08-24（精确时间以Cloudflare控制台为准） |
| Node版本 | 24.15.0 |
| npm版本 | 11.12.1 |
| 测试数量 | 15个测试文件，164个测试 |
| 构建结果 | 本地构建和dist审计通过；生产产物远程验证通过 |
| 普通模型SHA-256 | `854590B5A6AE2C54CB560D7FDF22A4CD249BB0339323CB68DA7DC64915FB180D` |
| AR模型SHA-256 | `06EC186E114F4B77BF38A39DF83A4C11AF1B5E3CF4BDFD606CEE3A6E615DF4EB` |
| 普通模型远程SHA-256 | `854590B5A6AE2C54CB560D7FDF22A4CD249BB0339323CB68DA7DC64915FB180D` |
| AR模型远程SHA-256 | `06EC186E114F4B77BF38A39DF83A4C11AF1B5E3CF4BDFD606CEE3A6E615DF4EB` |
| 普通页面验证 | 通过：仅加载动画模型，拆解、暂停、继续、完成和动画中重置正常 |
| AR页面验证 | 通过：仅加载静态AR模型，动画控件隐藏，桌面不支持AR时安全降级 |
| 响应头验证 | 通过：HTML安全头、GLB MIME/CORS/缓存、哈希资源immutable缓存符合预期 |
| 404验证 | 通过：缺失GLB返回真实HTTP 404，不回退HTML首页 |
| 桌面控制台错误 | 未发现未处理错误或警告 |
| iOS真机验证 | 尚未验证 |
| Android真机验证 | 尚未验证 |
| 微信验证 | 尚未验证 |
| 已知问题 | 桌面浏览器不提供手机AR能力属预期；真机AR、权限、平面和75毫米实测待验证 |
| 回退版本 | `c86083315c6f47d9ad7c4cde69ad2c894ab4dd6e` |

## 构建与发布证据

```text
本地 npm run test：15个测试文件、164个测试通过
本地 npx tsc --noEmit：通过
本地 npm run build：通过（仅保留model-viewer既有chunk大小提示）
本地 npm run deploy:dist：通过
Cloudflare构建日志：本次未由Codex直接读取完整日志
Cloudflare生产产物：通过远程页面、资源、响应头、哈希和404检查确认已上传
```

## 远程验证命令

```bash
npm run deploy:verify -- https://luban-lock-3d-ar.pages.dev
```

## 浏览器与真机备注

```text
桌面浏览器：Codex in-app browser（版本号未暴露）
检查尺寸：320×568、375×667、390×844、430×932及桌面宽屏
普通模式网络请求：仅 /models/luban-lock.glb
AR模式网络请求：仅 /models/luban-lock-ar.glb
横向溢出：上述尺寸均未发现
按钮高度：所有可见操作按钮至少48px
控制台未处理错误：未发现
真机型号与系统：尚未验证
AR后端：Quick Look、WebXR、Scene Viewer均尚未真机验证
```
