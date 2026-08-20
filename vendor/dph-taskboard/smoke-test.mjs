#!/usr/bin/env node
// DPH 任务看板冒烟测试（独立客户端插件版）：在 Node 中模拟浏览器模块环境，
// 加载 lib/client.js（__ModuleLoader__.load 格式），apply 注入 sessions/workspaces 服务，
// 用真实 React 渲染入口按钮 / 看板弹层 / 编辑弹窗 / 导出选择面板，捕捉加载/渲染期错误。
// 用法：node smoke-test.mjs（自动先构建，保证测的是最新代码）
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// 先构建（若 lib/client.js 过期则测的是旧代码）
try {
  execSync("node scripts/build.mjs", { stdio: "inherit" });
} catch (err) {
  console.error("❌ 构建失败，中止冒烟测试:", err.message);
  process.exit(1);
}

const BUNDLE = new URL("./lib/client.js", import.meta.url).pathname;

// 定位 harness 的 node_modules（全局安装或 npx 缓存），供加载 react 等依赖
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function resolveDshNodeModules() {
  const home = homedir();
  const env = process.env.DSH_NM;
  const candidates = [
    env,
    join(home, ".local/lib/node_modules/@deepseek-ai/dsh/node_modules"),
    join(home, "node_modules/@deepseek-ai/dsh/node_modules"),
    "/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules"
  ];
  for (const p of candidates) if (p && existsSync(join(p, "react"))) return p;
  throw new Error("未找到 harness 的 node_modules（含 react）。请用环境变量 DSH_NM 指定，例如：DSH_NM=~/.local/lib/node_modules/@deepseek-ai/dsh/node_modules node smoke-test.mjs");
}
const DSH_NM = resolveDshNodeModules();

const requireDsh = createRequire(DSH_NM + "x.js");
const React = requireDsh("react");
const ReactDomServer = requireDsh("react-dom/server");
const ReactJsxRuntime = requireDsh("react/jsx-runtime");

// primitives 真实包依赖 .css 无法在 Node 加载，用等价 stub 验证渲染路径
const PrimitivesStub = {
  Tooltip: (props) => React.createElement("span", { "data-tooltip": props.label, title: props.label }, props.children),
  IconChecklistOutline14: (props) => React.createElement("svg", { "data-icon": "checklist", width: props.size || 14, height: props.size || 14 }, null),
  IconSearchOutline16: (props) => React.createElement("svg", { "data-icon": "search", width: props.size || 16, height: props.size || 16 }, null)
};

// ── 浏览器环境模拟 ───────────────────────────────────────────────────────
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v))
  },
  confirm: () => true
};
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ dataset: {}, set textContent(v) {}, appendChild() {} }),
  head: { appendChild() {} },
  body: {}
};
globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
globalThis.URL = globalThis.URL ?? { createObjectURL: () => "blob:x", revokeObjectURL: () => {} };

// ── harness 服务 mock ────────────────────────────────────────────────────
const sessionSnapshot = {
  ids: ["s1", "s2"],
  byId: {
    s1: { id: "s1", title: "测试会话：写代码", running: true, cwd: "/Users/demo/proj", updatedAt: 2000 },
    s2: { id: "s2", title: "旧会话", running: false, completed: true, cwd: "/Users/demo/old", updatedAt: 1000 }
  },
  current: "s1"
};
const storeMock = (snapshot) => ({ getSnapshot: () => snapshot, subscribe: () => () => {} });
const sessionsSvc = { list: storeMock(sessionSnapshot), open: () => {}, create: async () => ({ ok: true, value: { sessionId: "new-1" } }), archiveSession: async () => ({ ok: true }) };
const workspacesSvc = { list: storeMock({ items: [], archivedSessionIds: [] }) };
const ctxStub = { sessions: sessionsSvc, workspaces: workspacesSvc };

// ── 加载 bundle（可强制打开弹层的变体）───────────────────────────────────
function loadBundle(forceOpen, forceEditor, forceExport) {
  let code = readFileSync(BUNDLE, "utf8");
  if (forceOpen) code = code.replace(/openBoard \? __dph_h\(__dph_TaskBoardOverlay/, "true ? __dph_h(__dph_TaskBoardOverlay");
  if (forceEditor) {
    code = code.replace(/editing \? __dph_h\(__dph_SessionMetaEditor/, '({ sessionId: "s1" }) ? __dph_h(__dph_SessionMetaEditor');
    code = code.replace(/editing\.sessionId/g, '"s1"');
  }
  if (forceExport) code = code.replace(/exportOpen \? __dph_h\(__dph_ExportPicker/, "true ? __dph_h(__dph_ExportPicker");
  const moduleTable = {
    "react": React,
    "react/jsx-runtime": ReactJsxRuntime,
    // SSR 测试下 createPortal 没有真实 DOM 容器，直接内联渲染子节点
    "react-dom": { createPortal: (children) => children },
    "@deepseek-ai/dsh-client-ui-primitives": PrimitivesStub
  };
  let exported = null;
  globalThis.window.__ModuleLoader__ = {
    load: (entry) => {
      exported = entry.factory((id) => {
        if (!(id in moduleTable)) throw new Error("unknown module: " + id);
        return moduleTable[id];
      });
      return exported;
    }
  };
  new Function("window", "document", "URL", code)(globalThis.window, globalThis.document, globalThis.URL);
  if (!exported || typeof exported.apply !== "function") throw new Error("bundle 没有导出 apply");
  if (typeof exported.__dphTaskBoardButton !== "function") throw new Error("bundle 没有导出 __dphTaskBoardButton");
  exported.apply(ctxStub); // 模拟 cordis 客户端插件激活（注入服务）
  return exported;
}

// 1) 加载 + apply
const mod = loadBundle(false, false, false);
console.log("OK: 客户端插件 bundle 加载成功，apply 注入 sessions/workspaces 服务");

// 2) 入口按钮（wide：margin-left:auto 贴右；rail：独立行）
const htmlClosed = ReactDomServer.renderToStaticMarkup(React.createElement(mod.__dphTaskBoardButton, { rail: false }));
if (!htmlClosed.includes("任务看板")) throw new Error("FAIL: 按钮 tooltip 缺失");
if (!htmlClosed.includes("<svg")) throw new Error("FAIL: 按钮图标未渲染");
if (!htmlClosed.includes("dph-tb-searchbtn")) throw new Error("FAIL: 按钮 class 缺失");
if (htmlClosed.includes("dph-tb-overlay")) throw new Error("FAIL: 弹层不应在关闭状态渲染");
const htmlRail = ReactDomServer.renderToStaticMarkup(React.createElement(mod.__dphTaskBoardButton, { rail: true }));
if (!htmlRail.includes("dph-tb-searchbtn-rail")) throw new Error("FAIL: rail 模式按钮 class 缺失");
console.log("OK: 入口按钮渲染（searchbtn + rail 变体）");

// 3) 看板弹层（强制打开：四列 + 会话总览 + 回收站 + 删除/配色）
const modOpen = loadBundle(true, false, false);
const htmlOpen = ReactDomServer.renderToStaticMarkup(React.createElement(modOpen.__dphTaskBoardButton, {}));
for (const expect of ["会话看板", "待办", "进行中", "评审中", "已完成", "回收站", "会话", "新建会话"]) {
  if (!htmlOpen.includes(expect)) throw new Error("FAIL: 看板缺少 " + expect);
}
for (const expect of ["测试会话：写代码", "旧会话", "当前", "处理中", "/Users/demo/proj"]) {
  if (!htmlOpen.includes(expect)) throw new Error("FAIL: 会话列缺少 " + expect);
}
if (!htmlOpen.includes('draggable="true"')) throw new Error("FAIL: 会话卡片应可拖拽");
if (!htmlOpen.includes("🗑")) throw new Error("FAIL: 会话删除按钮缺失");
if (!htmlOpen.includes("--dph-sess-accent")) throw new Error("FAIL: 会话状态配色变量缺失");
console.log("OK: 看板弹层渲染（四列 + 会话总览 + 回收站 + 删除/配色）");

// 4) 编辑弹窗（强制打开：关联会话下拉单选）
const modEdit = loadBundle(true, true, false);
const htmlEdit = ReactDomServer.renderToStaticMarkup(React.createElement(modEdit.__dphTaskBoardButton, {}));
for (const expect of ["会话备注", "描述", "优先级", "标签（逗号分隔）", "保存"]) {
  if (!htmlEdit.includes(expect)) throw new Error("FAIL: 编辑弹窗缺少 " + expect);
}
console.log("OK: 编辑弹窗渲染（关联会话下拉单选）");

// 5) 导出选择面板（强制打开）
const modExport = loadBundle(true, false, true);
const htmlExport = ReactDomServer.renderToStaticMarkup(React.createElement(modExport.__dphTaskBoardButton, {}));
for (const expect of ["选择要导出的会话", "测试会话：写代码", "旧会话", "全选", "导出"]) {
  if (!htmlExport.includes(expect)) throw new Error("FAIL: 导出面板缺少 " + expect);
}
if (!htmlExport.includes('type="checkbox"')) throw new Error("FAIL: 导出面板缺少打勾选择框");
console.log("OK: 导出选择面板渲染（打勾自由选择会话 + 全选）");

console.log("\nALL SMOKE TESTS PASSED");
