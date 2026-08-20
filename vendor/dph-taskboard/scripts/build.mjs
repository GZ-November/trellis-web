#!/usr/bin/env node
// 构建：src/client/index.js → lib/client.js（客户端插件 bundle，__ModuleLoader__.load 格式）
// 用法：node scripts/build.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGE = "@dph/taskboard";

console.log("🔨 开始构建 DPH 任务看板插件...");

try {
  // 检查源文件是否存在
  const srcPath = join(ROOT, "src/client/index.js");
  let src;
  try {
    src = readFileSync(srcPath, "utf8");
  } catch (err) {
    console.error(`❌ 错误：无法读取源文件 ${srcPath}`);
    console.error(err.message);
    process.exit(1);
  }

  // 去掉 region 标记行
  const body = src
    .replace(/^\/\/#region.*\n/, "")
    .replace(/\n\/\/#endregion.*$/, "");

  const bundle = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(PACKAGE)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
		return module.exports;
	}
});
`;

  // 确保lib目录存在
  mkdirSync(`${ROOT}/lib`, { recursive: true });
  
  // 写入构建文件
  const outputPath = join(ROOT, "lib/client.js");
  writeFileSync(outputPath, bundle);
  
  console.log(`✅ 构建成功！`);
  console.log(`   输出文件: ${outputPath}`);
  console.log(`   文件大小: ${bundle.length} 字节`);
  console.log(`   源文件行数: ${src.split('\n').length}`);
  console.log(`   构建文件行数: ${bundle.split('\n').length}`);
  
} catch (err) {
  console.error("❌ 构建过程中发生错误:");
  console.error(err);
  process.exit(1);
}
