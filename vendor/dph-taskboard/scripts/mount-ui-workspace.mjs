#!/usr/bin/env node
// DPH 任务看板：ui-workspace 挂载点补丁。
// 在侧边栏「工作区」的搜索图标左侧注入一个挂载锚点 div（wide/rail 两处），
// 挂载 div 承担 seat 布局（wide: margin-left:auto 贴右；rail: 独立行 36×36），
// 并注入一条 CSS 覆盖（searchSlot 的 margin-left:auto → 0），让独立客户端插件
// @dph/taskboard 的按钮紧贴搜索图标渲染。
// 幂等：已注入则跳过；`--revert` 完全移除。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// 目标 bundle：可用 --target=<绝对路径> 指定（如 npx 缓存实例）。
// 默认自动探测：全局安装副本 → 本机常见安装位置。
function resolveBundle() {
  const argTarget = process.argv.find((a) => a.startsWith("--target="));
  if (argTarget) return argTarget.slice("--target=".length);
  const home = homedir();
  const candidates = [
    join(home, ".local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js"),
    join(home, "node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js"),
    "/usr/local/lib/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js",
    "/usr/lib/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js"
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  throw new Error("未找到 dsh-client-ui-workspace bundle。请用 --target=<绝对路径> 指定（如 npx 缓存实例的副本）。");
}
const BUNDLE = resolveBundle();

const REVERT = process.argv.includes("--revert");

const wideMount = 'wide && (0, react_jsx_runtime.jsx)("div", { "data-dph-taskboard-mount": true, style: { display: "inline-flex", alignItems: "center", marginLeft: "auto" } })';
const railMount = '!wide && (0, react_jsx_runtime.jsx)("div", { "data-dph-taskboard-mount": true, "data-dph-taskboard-rail": true, style: { display: "inline-flex", alignItems: "center", width: 36, height: 36, marginBottom: 12 } })';
// 旧版按钮注入（迁移前的产物，需清理）
const oldWide = "wide && (0, react_jsx_runtime.jsx)(__dph_TaskBoardButton, { useSessions, useWorkspaces, open, archiveSession })";
const oldRail = "!wide && (0, react_jsx_runtime.jsx)(__dph_TaskBoardButton, { useSessions, useWorkspaces, open, archiveSession, rail: true })";
const wideAnchor = 'wide && (0, react_jsx_runtime.jsx)("div", {\n\t\t\t\t\t\t\t\tclassName: clsx(WorkspaceBrowser_module_css_default.searchSlot,';
const railAnchor = '!wide && (0, react_jsx_runtime.jsx)("div", {\n\t\t\t\t\t\tclassName: WorkspaceBrowser_module_css_default.search,';
const anchorRe = /^[ \t]*exports\.apply = apply;$/m;

// 顶层 CSS 覆盖（让按钮紧贴搜索图标；searchSlot 的 auto margin 会让按钮与搜索区均分空隙）
const cssOverride = `//#region ══ DPH TASKBOARD WORKSPACE MOUNT CSS ══
(function () {
	try {
		const slotCls = WorkspaceBrowser_module_css_default && WorkspaceBrowser_module_css_default.searchSlot;
		const id = "@dph/taskboard/ui-workspace-mount";
		if (slotCls && typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(id) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = id;
			tag.textContent = "." + slotCls + "{margin-left:0}";
			document.head.appendChild(tag);
		}
	} catch (err) { /* noop */ }
})();
//#endregion ══ DPH TASKBOARD WORKSPACE MOUNT CSS ══
`;

let bundle = readFileSync(BUNDLE, "utf8");

// 0) 幂等：已注入则直接跳过（检测放在 strip 之前，避免"删了又插"累积字节）；--revert 不受限
const alreadyMounted = bundle.includes(wideMount) && bundle.includes(railMount) && bundle.includes("DPH TASKBOARD WORKSPACE MOUNT CSS");
if (!REVERT && alreadyMounted) {
  console.log("no change (already up to date)");
  process.exit(0);
}

let next = bundle;

// 1) 幂等移除：所有历史挂载 div 行（含旧版无 style 变体）+ 旧 CSS 覆盖区域
const stripLines = (code) => code
  .split("\n")
  .filter((line) => !line.includes("data-dph-taskboard-mount") && !line.includes("__dph_TaskBoardButton"))
  .join("\n");
next = stripLines(next);
next = next.replace(/\n+[ \t]*\/\/#region .*DPH TASKBOARD WORKSPACE MOUNT CSS.*\n[\s\S]*?[ \t]*\/\/#endregion .*DPH TASKBOARD WORKSPACE MOUNT CSS.*\n/g, "\n");
next = next.replace(/\n\/\/ dsh-hmr-test[^\n]*$/g, "").replace(/\n\/\/ dph-hmr-probe[^\n]*$/g, "");

if (REVERT) {
  writeFileSync(BUNDLE, next);
  console.log("reverted — ui-workspace 挂载点已移除");
  process.exit(0);
}

// 2) 注入两个挂载 div（搜索图标左侧）
if (next.includes(wideMount)) console.log("wide mount already present");
else {
  if (!next.includes(wideAnchor)) throw new Error("wide anchor not found: searchSlot");
  next = next.replace(wideAnchor, "\t\t\t\t\t\t\t\t" + wideMount + ",\n" + wideAnchor);
}
if (next.includes(railMount)) console.log("rail mount already present");
else {
  if (!next.includes(railAnchor)) throw new Error("rail anchor not found: rail search");
  next = next.replace(railAnchor, "\t\t\t\t\t" + railMount + ",\n" + railAnchor);
}

// 3) 注入顶层 CSS 覆盖（exports.apply 之前）
if (next.includes("DPH TASKBOARD WORKSPACE MOUNT CSS")) console.log("css override already present");
else {
  const anchor = next.match(anchorRe);
  if (!anchor) throw new Error("anchor not found: exports.apply = apply;");
  const cssIndented = cssOverride.split("\n").map((l) => "\t\t" + l).join("\n") + "\n";
  next = next.slice(0, anchor.index) + cssIndented + next.slice(anchor.index);
}

if (next === bundle) console.log("no change (already up to date)");
else {
  writeFileSync(BUNDLE, next);
  console.log("spliced OK — workspace bundle:", next.length, "bytes");
}
