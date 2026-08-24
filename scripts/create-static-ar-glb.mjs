import path from 'node:path';

import { writeStaticArGlb } from './lib/static-ar-glb.mjs';

const projectRoot = process.cwd();
const inputPath = path.join(projectRoot, 'public', 'models', 'luban-lock.glb');
const outputPath = path.join(projectRoot, 'public', 'models', 'luban-lock-ar.glb');

try {
  const report = await writeStaticArGlb(inputPath, outputPath);
  console.info('静态AR模型生成完成');
  console.info(`输入路径：${report.inputPath}`);
  console.info(`输出路径：${report.outputPath}`);
  console.info(`原模型SHA-256：${report.sourceHash}`);
  console.info(`AR模型SHA-256：${report.outputHash}`);
  console.info(`原动画名称：${report.sourceAnimationNames.join(', ')}`);
  console.info(`输出动画数量：${report.outputAnimationCount}`);
  console.info(`原文件大小：${report.sourceSize} bytes`);
  console.info(`输出文件大小：${report.outputSize} bytes`);
  console.info(`验证结果：${report.validation}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`静态AR模型生成失败：${message}`);
  process.exitCode = 1;
}
