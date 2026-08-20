#!/usr/bin/env node
// 部署 DPH 任务看板到 web profile：
// 1) 构建客户端 bundle；2) 复制包到 ~/.dsh/profiles/web/packages/dph-taskboard/；
// 3) 在 ~/.dsh/profiles/web/cordis.patch.yml 注册（insert dsh.client 行）。
// 部署后需重启 harness（`dsh web`）生效；重启会中断当前会话。
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { join } from "node:path";

console.log("🚀 开始部署 DPH 任务看板插件...");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// 部署到 harness 共享模块区（~/.dsh/profiles/node_modules，loader 从 profile baseUrl 按 bare specifier 解析）
const PROFILE_DIR = join(process.env.HOME, ".dsh/profiles/web");
const MODULES_DIR = join(process.env.HOME, ".dsh/profiles/node_modules");
const PKG_DIR = join(MODULES_DIR, "@dph/taskboard");
const PATCH_FILE = join(PROFILE_DIR, "cordis.patch.yml");

// 1) 构建
execSync("node scripts/build.mjs", { cwd: ROOT, stdio: "inherit" });

// 2) 复制包（package.json + lib + src）
mkdirSync(PKG_DIR, { recursive: true });
for (const item of ["package.json", "lib", "src"]) {
  const from = join(ROOT, item);
  if (!existsSync(from)) throw new Error(`missing ${from}`);
  cpSync(from, join(PKG_DIR, item), { recursive: true });
}
console.log("copied package →", PKG_DIR);

// 3) 注册 patch（bare specifier：loader 与 client-modules 都以 profile baseUrl 解析）
// 注册内容以仓库根 cordis.patch.yml（bundle manifest）为单一来源
const row = readFileSync(join(ROOT, "cordis.patch.yml"), "utf8").trimEnd() + "\n";
let patch = "";
if (existsSync(PATCH_FILE)) patch = readFileSync(PATCH_FILE, "utf8");
// 清理旧的/重复的 taskboard insert 段（含历史 ./packages 与引号变体），再写唯一一段
const oldRows = /\n*# DPH 任务看板客户端插件（@dph\/taskboard）—— 由 scripts\/deploy\.mjs 维护\n- insert:\n    - id: taskboard\n      name: [^\n]*/g;
const cleaned = patch.replace(oldRows, "");
const base = cleaned.trim() === "[]" || cleaned.trim() === "" ? "" : cleaned.trimEnd() + "\n";
const target = base + row;
if (target === patch) {
  console.log("patch already registered");
} else {
  writeFileSync(PATCH_FILE, target);
  console.log("registered in", PATCH_FILE);
}

// 检查 ui-workspace 挂载补丁是否就位（未挂载则按钮不会出现）
let mountOK = true;
for (const p of [
  join(process.env.HOME, ".npm/_npx"),
  join(process.env.HOME, ".local/lib/node_modules/@deepseek-ai/dsh")
]) {
  try {
    const wsBundle = execSync(
      `find ${JSON.stringify(p)} -path "*dsh-client-ui-workspace/lib/client.js" -not -path "*/node_modules/*/node_modules/*/node_modules/*" 2>/dev/null | head -1`,
      { shell: true, encoding: "utf8" }
    ).trim();
    if (wsBundle && !readFileSync(wsBundle, "utf8").includes("data-dph-taskboard-mount")) mountOK = false;
  } catch (err) { /* noop */ }
}
if (!mountOK) {
  console.log("\n⚠️ 检测到 ui-workspace 挂载点补丁未生效（侧边栏按钮不会出现）。");
  console.log("   请执行：npm run mount:workspace  （或 node scripts/mount-ui-workspace.mjs --target=<副本路径>）");
}

console.log("\n✅ 部署完成。重启 harness（dsh web）后生效；重启会中断当前会话，请安排好再执行。");
