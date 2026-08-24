import { defineConfig } from 'vite';

export default defineConfig({
  // 页面模式只依赖根页面查询参数；关闭SPA回退以保留模型缺失的真实404。
  appType: 'mpa',
});
