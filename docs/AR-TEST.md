# 六通鲁班锁AR真机测试清单

## 测试边界

WebXR访问摄像头、追踪空间并识别平面，需要安全上下文。正式验收应使用HTTPS部署地址，并确保页面与 `/models/luban-lock-ar.glb` 都能通过HTTPS访问。`http://127.0.0.1` 可被部分浏览器视为本机安全来源，但只适合桌面页面、模型和降级逻辑验证，不能证明手机AR可用；手机通过 `http://192.168.x.x` 等局域网地址访问通常不是安全上下文。

Chrome DevTools的手机尺寸模拟不提供ARCore、Quick Look、真实摄像头、平面识别或真实多点触控，不能替代以下真机测试。

## 测试前准备

1. 执行 `npm run model:ar`、`npm run test` 和 `npm run build`。
2. 确认 `public/models/luban-lock-ar.glb` 与 `dist/models/luban-lock-ar.glb` 的SHA-256一致。
3. 确认静态AR模型不含顶层 `animations`，原模型仍包含 `Assemble` 和 `Disassemble`。
4. 准备可访问的HTTPS测试地址，不使用混合内容或需要登录的模型URL。尚未部署时记录为 `<pages.dev生产地址>`，不得把占位符写成已验证结果。
5. 准备刻度尺、光线充足且带纹理的水平桌面，以及约75毫米的实物参照。

生产地址记录位置：

```text
pages.dev地址：<pages.dev生产地址>
普通页面：<pages.dev生产地址>/
AR页面：<pages.dev生产地址>/?mode=ar
AR模型：<pages.dev生产地址>/models/luban-lock-ar.glb
```

得到真实地址后先执行 `npm run deploy:verify -- <pages.dev生产地址>`，确认页面、模型哈希、MIME、CORS、缓存和缺失模型404，再开始真机测试。

## iOS Safari / Quick Look

1. 使用实际iPhone或iPad的Safari打开HTTPS页面 `/?mode=ar`。
2. 允许网页所需权限，确认静态3D预览先正常加载。
3. 确认页面提示设备支持AR后，点击“放到现实中”。
4. 确认Quick Look能生成并打开USDZ，没有无限加载或空白预览。
5. 缓慢移动设备识别水平桌面并放置完整组装的鲁班锁。
6. 返回Safari，确认页面显示“已返回网页，可再次启动AR”，按钮可再次使用。
7. 本阶段没有 `ios-src`；若动态USDZ转换失败，应记录设备、iOS版本和Safari版本，后续再单独生成并验证USDZ，不要临时放入未经验证的文件。

## Android Chrome / WebXR

1. 在支持ARCore的实际Android设备上安装或更新Chrome。
2. 在Google Play中确认 **Google Play Services for AR** 已安装且为可用版本；也可对照Google官方ARCore支持设备列表检查机型。
3. 用Chrome打开HTTPS页面 `/?mode=ar`，允许摄像头和AR权限。
4. 点击“放到现实中”，确认进入WebXR并看到“请缓慢移动手机寻找水平平面”。
5. 在光线较弱或无纹理表面检查 `not-tracking` 提示，再移向有纹理桌面确认提示恢复。
6. 放置模型后围绕模型移动，确认遮挡、视角和稳定性合理。

## Android Scene Viewer

1. 在支持Scene Viewer的Android设备和浏览器中打开同一HTTPS页面。
2. 启动AR，记录实际选中的后端是否为Scene Viewer。
3. 确认只显示完整组装模型，不循环播放 `Assemble` 或 `Disassemble`。
4. 从外部查看器返回网页，确认按钮重新启用且网页没有把后台切换误报为“放置成功”。
5. 在未安装或未更新AR服务时验证中文降级提示和返回普通3D功能。

## 微信内置浏览器

1. 在微信中打开HTTPS页面，记录微信版本、系统版本和机型。
2. 不预设微信一定支持AR；先确认静态3D预览和返回按钮可用。
3. 若 `canActivateAR` 为false或启动失败，确认页面没有空白和未处理异常。
4. 点击右上角“在浏览器打开”，分别在iOS Safari或Android Chrome重复对应测试。

## 权限与平面识别

- 首次允许摄像头/AR权限后可正常启动。
- 首次拒绝权限后显示中文失败提示，静态3D预览仍可用，再次点击不会产生并发请求。
- 从系统设置重新授权后可再次尝试。
- 光线充足、有纹理的水平桌面能被识别。
- 暗光、反光、纯色桌面下出现追踪建议但不崩溃。
- 模型放置在桌面表面，没有明显悬空或沉入桌面。

## 75毫米真实尺寸

1. 确认页面和元素使用 `ar-scale="fixed"`、`ar-placement="floor"`，没有 `scale` 属性。
2. 将刻度尺与AR模型放在同一桌面平面，在多个角度观察。
3. 测量鲁班锁最大尺寸，目标约75毫米；记录合理的视觉/追踪误差。
4. 尝试常见缩放手势，确认AR查看器没有把模型任意缩放成几十厘米。
5. 普通3D预览中的双指缩放只改变相机观察距离，不应修改模型真实尺寸。

## 后台、弱网和失败降级

- 启动AR后切到其他App，再返回网页，按钮和状态可恢复。
- 锁屏再解锁，页面不出现无限“正在启动AR”。
- 限速或弱网下静态AR模型显示加载进度，失败后可重试。
- 模型URL返回404时显示“未找到AR模型，请运行 npm run model:ar。”。
- 模型格式无效、动态USDZ失败、ARCore不可用或权限拒绝时保留静态3D预览。
- 所有失败路径都能使用“返回3D拆装”，并且普通模式仍加载 `/models/luban-lock.glb`。

## 测试记录

| 日期 | 设备/机型 | 系统版本 | 浏览器/微信版本 | HTTPS地址 | 后端 | 权限 | 平面识别 | 约75mm | 后台返回 | 结果/问题 |
|---|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  | WebXR / Scene Viewer / Quick Look |  |  |  |  |  |

桌面浏览器验证应单独记录，不在此表中填写为真机通过。
