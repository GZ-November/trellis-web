//#region ══════════════════════ DPH TASKBOARD CLIENT ══════════════════════
// DPH 任务看板 —— 独立客户端插件（dsh.client: web）。
// 完全会话化：看板卡片 = 会话（harness 会话）；新建卡片 = 新建会话（出现在侧边栏）；
// 四列管理会话状态；删除 = 归档进回收站（可恢复）；备注（描述/优先级/标签）存浏览器 localStorage。
// 入口按钮挂载到 ui-workspace 提供的 [data-dph-taskboard-mount] 锚点（搜索图标左侧）。
const __dph_react = require("react");
const __dph_react_dom = require("react-dom");
const __dph_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
// React 18：createRoot 在 "react-dom/client" 子路径（主入口不一定有）；兜底 legacy render
let __dph_createRoot = null;
try {
	const clientEntry = require("react-dom/client");
	if (clientEntry && typeof clientEntry.createRoot === "function") __dph_createRoot = clientEntry.createRoot;
} catch (err) { /* fall through */ }
if (!__dph_createRoot && typeof __dph_react_dom.createRoot === "function") __dph_createRoot = __dph_react_dom.createRoot;
const __dph_h = (type, props, ...children) => __dph_react.createElement(type, props ?? null, ...children);

// ── 常量 ──────────────────────────────────────────────────────────────
const __dph_STORAGE_KEY = "dph.taskboard.v1";
const __dph_COLUMNS = [
	{ id: "todo", title: "待办", accent: "#5b8def" },
	{ id: "doing", title: "进行中", accent: "#e8a13a" },
	{ id: "review", title: "评审中", accent: "#9b7bf0" },
	{ id: "done", title: "已完成", accent: "#3fbf8f" }
];
const __dph_PRIORITIES = [
	{ id: "low", label: "低", color: "#8a94a6" },
	{ id: "medium", label: "中", color: "#5b8def" },
	{ id: "high", label: "高", color: "#e8a13a" },
	{ id: "urgent", label: "紧急", color: "#e5534b" }
];

// ── 数据层：会话归类 + 会话备注（浏览器 localStorage）─────────────────────
let __dph_sessionCols = {};   // { [sessionId]: colId }
let __dph_sessionMeta = {};   // { [sessionId]: { description, priority, labels } }
let __dph_loaded = false;
// 最近新建的会话（blank 但应显示，直到它有了第一条消息）
let __dph_newSessions = [];
const __dph_listeners = new Set();
// harness 客户端服务（apply 时注入捕获）：sessions（list/open/create/archiveSession）、workspaces（archivedSessionIds）
let __dph_svc = { sessions: null, workspaces: null, connection: null };
const __dph_overlay = { open: false, listeners: new Set() };

// 订阅 harness 的 snapshot store（sessions.list / workspaces.list）
function __dph_useStore(store) {
	const [, force] = __dph_react.useReducer((x) => x + 1, 0);
	__dph_react.useEffect(() => {
		if (!store || typeof store.subscribe !== "function") return;
		return store.subscribe(force);
	}, [store]);
	return store && typeof store.getSnapshot === "function" ? store.getSnapshot() : null;
}

function __dph_load() {
	if (__dph_loaded) return true;
	__dph_loaded = true;
	try {
		const raw = window.localStorage.getItem(__dph_STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			__dph_sessionCols = parsed.sessionCols && typeof parsed.sessionCols === "object" ? parsed.sessionCols : {};
			__dph_sessionMeta = parsed.sessionMeta && typeof parsed.sessionMeta === "object" ? parsed.sessionMeta : {};
			__dph_newSessions = Array.isArray(parsed.newSessions) ? parsed.newSessions : [];
			// 迁移：旧版任务卡片（带 sessionId 的）备注并入会话备注
			if (Array.isArray(parsed.cards)) {
				for (const c of parsed.cards) {
					if (c && typeof c.sessionId === "string" && c.sessionId !== "" && !__dph_sessionMeta[c.sessionId]) {
						const meta = {};
						if (typeof c.description === "string" && c.description) meta.description = c.description;
						if (typeof c.priority === "string" && __dph_PRIORITIES.some((p) => p.id === c.priority)) meta.priority = c.priority;
						if (Array.isArray(c.labels) && c.labels.length) meta.labels = c.labels.filter((l) => typeof l === "string");
						if (Object.keys(meta).length) __dph_sessionMeta[c.sessionId] = meta;
					}
				}
			}
		}
	} catch (err) { /* 忽略损坏数据 */ }
	return true;
}
function __dph_persist() {
	try {
		window.localStorage.setItem(__dph_STORAGE_KEY, JSON.stringify({ version: 3, sessionCols: __dph_sessionCols, sessionMeta: __dph_sessionMeta, newSessions: __dph_newSessions }));
	} catch (err) { /* 存储不可用时仅内存生效 */ }
	__dph_scheduleSync();
}
// 仅落 localStorage，不触发宿主同步（供同步流程内部收敛使用，避免递归调度）
function __dph_persistLocalOnly() {
	try {
		window.localStorage.setItem(__dph_STORAGE_KEY, JSON.stringify({ version: 3, sessionCols: __dph_sessionCols, sessionMeta: __dph_sessionMeta, newSessions: __dph_newSessions }));
	} catch (err) { /* noop */ }
}
function __dph_notify() {
	for (const l of __dph_listeners) { try { l(); } catch (err) { /* noop */ } }
}
// 会话归属列：colId 为空串/非法 → 回到「会话」列
function __dph_setSessionCol(sessionId, colId) {
	__dph_load();
	if (colId == null || colId === "" || !__dph_COLUMNS.some((k) => k.id === colId)) delete __dph_sessionCols[sessionId];
	else __dph_sessionCols[sessionId] = colId;
	__dph_persist();
	__dph_notify();
}
// 保存会话备注（描述/优先级/标签）
function __dph_saveSessionMeta(sessionId, meta) {
	__dph_load();
	const cleaned = {};
	if (meta && typeof meta.description === "string" && meta.description.trim()) cleaned.description = meta.description.trim();
	if (meta && __dph_PRIORITIES.some((p) => p.id === meta.priority)) cleaned.priority = meta.priority;
	if (meta && Array.isArray(meta.labels)) cleaned.labels = meta.labels.filter((l) => typeof l === "string" && l !== "");
	if (Object.keys(cleaned).length) __dph_sessionMeta[sessionId] = cleaned;
	else delete __dph_sessionMeta[sessionId];
	__dph_persist();
	__dph_notify();
}
function __dph_useLoaded() {
	const [, force] = __dph_react.useReducer((x) => x + 1, 0);
	__dph_react.useEffect(() => {
		__dph_listeners.add(force);
		return () => __dph_listeners.delete(force);
	}, []);
	__dph_load();
	return true;
}
function __dph_useOverlay() {
	const [, force] = __dph_react.useReducer((x) => x + 1, 0);
	__dph_react.useEffect(() => {
		__dph_overlay.listeners.add(force);
		return () => __dph_overlay.listeners.delete(force);
	}, []);
	return [__dph_overlay.open, (v) => {
		__dph_overlay.open = !!v;
		for (const l of __dph_overlay.listeners) { try { l(); } catch (err) { /* noop */ } }
	}];
}
function __dph_fmtTime(ts) {
	if (!Number.isFinite(ts)) return "";
	try {
		const d = new Date(ts);
		const p = (n) => String(n).padStart(2, "0");
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
	} catch (err) {
		return "";
	}
}

// ── 宿主同步：看板变化 → 防抖 → POST /api/dph/taskboard（宿主落盘，Agent 可读）──
let __dph_syncTimer = null;
function __dph_scheduleSync() {
	if (__dph_syncTimer !== null) return;
	__dph_syncTimer = setTimeout(() => {
		__dph_syncTimer = null;
		__dph_syncNow();
	}, 500);
}
function __dph_syncNow() {
	if (!__dph_loaded) return; // 数据未加载时不同步，避免空快照覆盖宿主文件
	try {
		const sessions = __dph_svc && __dph_svc.sessions && __dph_svc.sessions.list ? __dph_svc.sessions.list.getSnapshot() : null;
		if (!sessions || !sessions.byId) return; // 会话服务未就绪：跳过，避免空快照覆盖宿主文件
		// 收敛 newSessions：已消失（外部删除/归档）或已脱离空白（已有消息）的 id 移除
		if (sessions && sessions.byId && __dph_newSessions.length) {
			const pruned = __dph_newSessions.filter((id) => {
				const s = sessions.byId[id];
				return s !== void 0 && !!s.blank;
			});
			if (pruned.length !== __dph_newSessions.length) {
				__dph_newSessions = pruned;
				__dph_persistLocalOnly();
			}
		}
		// 与看板/侧边栏一致的过滤：隐藏子代理(subagent)、归档、以及非当前的空白(blank)会话
		let archivedSet = null;
		try {
			const ws = __dph_svc && __dph_svc.workspaces && __dph_svc.workspaces.list ? __dph_svc.workspaces.list.getSnapshot() : null;
			if (ws && Array.isArray(ws.archivedSessionIds)) archivedSet = new Set(ws.archivedSessionIds);
		} catch (err) { /* noop */ }
		const currentId = sessions ? sessions.current : void 0;
		const snap = {
			version: 3,
			syncedAt: Date.now(),
			sessions: sessions && sessions.byId
				? Object.keys(sessions.byId).map((id) => sessions.byId[id])
					.filter((s) => s.origin !== "subagent" && (!archivedSet || !archivedSet.has(s.id)) && (!s.blank || s.id === currentId || __dph_newSessions.includes(s.id)))
					.map((s) => ({ id: s.id, title: s.displayTitle || s.title || s.id, cwd: s.cwd || null, running: !!s.running, updatedAt: s.updatedAt || 0 }))
				: [],
			sessionMeta: { ...(__dph_sessionMeta || {}) },
			sessionCols: { ...(__dph_sessionCols || {}) }
		};
		fetch("/api/dph/taskboard", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(snap)
		}).then((r) => { if (!r.ok) throw new Error("http " + r.status); }).catch(() => { /* 同步失败不影响看板使用 */ });
	} catch (err) { /* noop */ }
}

// ── 入口按钮：搜索图标左侧，样式与搜索按钮完全一致 ────────────────────────
// 挂载点 div（ui-workspace 补丁渲染）承担 seat 布局（wide 贴右 / rail 独立行）。
function __dph_TaskBoardButton({ rail }) {
	const [openBoard, setOpenBoard] = __dph_useOverlay();
	__dph_useLoaded();
	return __dph_h(__dph_react.Fragment, null,
		__dph_h(__dph_primitives.Tooltip, {
			label: "任务看板",
			side: "bottom",
			delayMs: 500
		},
			__dph_h("button", {
				type: "button",
				className: "dph-tb-searchbtn" + (rail ? " dph-tb-searchbtn-rail" : ""),
				"aria-label": "任务看板",
				title: "任务看板",
				onClick: () => setOpenBoard(!openBoard)
			},
				__dph_h(__dph_primitives.IconChecklistOutline14, { size: rail ? 18 : 16 }))),
		openBoard ? __dph_h(__dph_TaskBoardOverlay, { onClose: () => setOpenBoard(false) }) : null);
}

// ── 看板弹层（完全会话化：卡片 = 会话）──────────────────────────────────
function __dph_TaskBoardOverlay({ onClose }) {
	__dph_useLoaded();
	const [search, setSearch] = __dph_react.useState("");
	const [editing, setEditing] = __dph_react.useState(null); // { sessionId } 备注编辑
	const [dragId, setDragId] = __dph_react.useState(null);
	const [dragOverCol, setDragOverCol] = __dph_react.useState(null);
	const [trashOpen, setTrashOpen] = __dph_react.useState(false);
	const [exportOpen, setExportOpen] = __dph_react.useState(false);
	const [createOpen, setCreateOpen] = __dph_react.useState(false);
	const fileRef = __dph_react.useRef(null);

	const sessionsSnap = __dph_useStore(__dph_svc.sessions ? __dph_svc.sessions.list : null);
	const workspacesSnap = __dph_useStore(__dph_svc.workspaces ? __dph_svc.workspaces.list : null);
	const sessionIds = sessionsSnap ? sessionsSnap.ids : null;
	const sessionById = sessionsSnap ? sessionsSnap.byId : null;
	const sessionCurrent = sessionsSnap ? sessionsSnap.current : null;
	const archivedIds = workspacesSnap && Array.isArray(workspacesSnap.archivedSessionIds) ? workspacesSnap.archivedSessionIds : null;
	const archivedSet = archivedIds ? new Set(archivedIds) : null;
	const sessions = sessionById
		? (sessionIds || Object.keys(sessionById)).map((id) => sessionById[id]).filter(Boolean)
			.filter((s) => s.origin !== "subagent" && (!archivedSet || !archivedSet.has(s.id)) && (!s.blank || s.id === sessionCurrent || __dph_newSessions.includes(s.id)))
			.sort((a, b) =>
				a.id === sessionCurrent ? -1 : b.id === sessionCurrent ? 1 : (b.updatedAt || 0) - (a.updatedAt || 0))
		: [];
	const isUnassigned = (s) => !__dph_COLUMNS.some((k) => k.id === __dph_sessionCols[s.id]);
	const unassignedSessions = sessions.filter(isUnassigned);
	const sessionsInCol = (colId) => sessions.filter((s) => __dph_sessionCols[s.id] === colId);
	const sessionTitleById = {};
	for (const s of sessions) sessionTitleById[s.id] = s.displayTitle || s.title || s.id;

	__dph_react.useEffect(() => {
		const onKey = (e) => {
			if (e.key !== "Escape") return;
			if (editing) { setEditing(null); return; }
			if (trashOpen) { setTrashOpen(false); return; }
			if (exportOpen) { setExportOpen(false); return; }
			if (createOpen) { setCreateOpen(false); return; }
			onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose, editing, trashOpen, exportOpen, createOpen]);

	// 搜索：会话标题 / 备注
	const q = search.trim().toLowerCase();
	const visibleSessions = q
		? sessions.filter((s) => {
			const meta = __dph_sessionMeta[s.id] || {};
			const text = (s.displayTitle || s.title || s.id) + " " + (meta.description || "") + " " + (meta.labels || []).join(" ");
			return text.toLowerCase().includes(q);
		})
		: sessions;
	const visibleUnassigned = visibleSessions.filter(isUnassigned);
	const visibleInCol = (colId) => visibleSessions.filter((s) => __dph_sessionCols[s.id] === colId);

	// 进入会话（关闭看板并切换）
	const handleOpenSession = (sessionId) => {
		const sessions = __dph_svc.sessions;
		if (sessions && typeof sessions.open === "function") {
			try { sessions.open(sessionId); } catch (err) { console.error("[dph-taskboard] 切换会话失败：", err); }
		}
		onClose();
	};
	// 删除（归档）会话 → 回收站（可恢复）；保留列信息与备注，恢复后回到原列（与侧边栏删除行为一致）
	const handleArchiveSession = (sessionId) => {
		const workspaces = __dph_svc.workspaces;
		if (!workspaces || typeof workspaces.archiveSession !== "function") {
			console.error("[dph-taskboard] workspaces.archiveSession 不可用", workspaces);
			window.alert("删除会话失败：会话归档服务不可用");
			return;
		}
		const onDone = () => { /* 保留 sessionCols/sessionMeta/newSessions，恢复时原样回归 */ };
		try {
			const result = workspaces.archiveSession(sessionId);
			if (result && typeof result.then === "function") result.then(onDone).catch((err) => window.alert("删除会话失败：" + (err && err.message ? err.message : String(err))));
			else onDone();
		} catch (err) { window.alert("删除会话失败：" + (err && err.message ? err.message : String(err))); }
	};
	// 新建会话：调用 harness sessions.create，立即出现在侧边栏与看板
	// 打开新建会话对话框
	const handleCreateSession = () => setCreateOpen(true);
	// 编辑会话备注
	const handleSaveMeta = (sessionId, meta) => {
		__dph_saveSessionMeta(sessionId, meta);
		setEditing(null);
	};

	// 导出：打勾选择的会话 + 备注 + 归类
	const doExport = (selectedIds) => {
		try {
			const sel = new Set(selectedIds);
			const snapSessions = sessions.filter((s) => sel.has(s.id)).map((s) => ({
				id: s.id,
				title: s.displayTitle || s.title || s.id,
				cwd: s.cwd || null,
				running: !!s.running,
				updatedAt: s.updatedAt || 0
			}));
			const relCols = {};
			const relMeta = {};
			for (const key of Object.keys(__dph_sessionCols)) if (sel.has(key)) relCols[key] = __dph_sessionCols[key];
			for (const key of Object.keys(__dph_sessionMeta)) if (sel.has(key)) relMeta[key] = __dph_sessionMeta[key];
			const snapshot = {
				version: 3,
				exportedAt: Date.now(),
				sessions: snapSessions,
				sessionCols: relCols,
				sessionMeta: relMeta,
				newSessions: __dph_newSessions.filter((id) => sel.has(id))
			};
			const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "taskboard-backup.json";
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			return true;
		} catch (err) { window.alert("导出失败：" + err.message); return false; }
	};
	const onImportFile = (e) => {
		const file = e.target.files && e.target.files[0];
		e.target.value = "";
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const parsed = JSON.parse(String(reader.result));
				if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("文件不是有效的看板备份 JSON");
				__dph_load();
				const colsIn = parsed.sessionCols && typeof parsed.sessionCols === "object" ? Object.keys(parsed.sessionCols).length : 0;
				const metaIn = parsed.sessionMeta && typeof parsed.sessionMeta === "object" ? Object.keys(parsed.sessionMeta).length : 0;
				const curCols = Object.keys(__dph_sessionCols).length;
				const curMeta = Object.keys(__dph_sessionMeta).length;
				if (!window.confirm(`导入将${curCols || curMeta ? "覆盖当前 " + curCols + " 条归类、" + curMeta + " 条备注，" : ""}恢复文件中的 ${colsIn} 条归类、${metaIn} 条备注。\n继续吗？`)) return;
				if (parsed.sessionCols && typeof parsed.sessionCols === "object") __dph_sessionCols = parsed.sessionCols;
				if (parsed.sessionMeta && typeof parsed.sessionMeta === "object") __dph_sessionMeta = parsed.sessionMeta;
				if (parsed && Array.isArray(parsed.newSessions)) {
					for (const id of parsed.newSessions) if (typeof id === "string" && !__dph_newSessions.includes(id)) __dph_newSessions.push(id);
				}
				__dph_persist();
				__dph_notify();
				window.alert(`导入完成：恢复 ${Object.keys(__dph_sessionCols).length} 条会话归类、${Object.keys(__dph_sessionMeta).length} 条会话备注。\n（会话本体由 harness 管理，未创建/覆盖会话）`);
			} catch (err) { window.alert("导入失败：" + err.message); }
		};
		reader.readAsText(file);
	};

	return __dph_react_dom.createPortal(
		__dph_h("div", { className: "dph-tb-overlay", onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
			__dph_h("div", { className: "dph-tb-shell" },
				// 头部
				__dph_h("div", { className: "dph-tb-head" },
					__dph_h("span", { className: "dph-tb-head-title" }, "会话看板"),
					__dph_h("span", { className: "dph-tb-head-count" }, `${sessions.length} 个会话`),
					__dph_h("input", {
						className: "dph-tb-search",
						type: "search",
						placeholder: "搜索会话标题 / 备注…",
						value: search,
						onChange: (e) => setSearch(e.target.value)
					}),
					__dph_h("span", { className: "dph-tb-head-spacer" }),
					__dph_h("button", { type: "button", className: "dph-tb-btn dph-tb-btn-primary", title: "新建一个会话（可选模型/命名，发送开始消息后出现在侧边栏）", onClick: handleCreateSession }, "＋ 新建会话"),
					__dph_h("button", { type: "button", className: "dph-tb-btn", title: "回收站（已删除会话，可恢复）", onClick: () => setTrashOpen(true) }, "回收站"),
					__dph_h("button", { type: "button", className: "dph-tb-btn", title: "选择会话导出", onClick: () => setExportOpen(true) }, "导出"),
					__dph_h("button", { type: "button", className: "dph-tb-btn", title: "导入 JSON", onClick: () => fileRef.current && fileRef.current.click() }, "导入"),
					__dph_h("input", { ref: fileRef, type: "file", accept: ".json,application/json", style: { display: "none" }, onChange: onImportFile }),
					__dph_h("button", { type: "button", className: "dph-tb-btn dph-tb-close", title: "关闭 (Esc)", onClick: onClose }, "✕")),
				// 列：会话列 + 状态列（全部是会话卡片）
				__dph_h("div", { className: "dph-tb-cols" },
					__dph_h(__dph_SessionColumn, {
						key: "__dph-sessions",
						sessions: visibleUnassigned,
						currentId: sessionCurrent,
						onOpen: handleOpenSession,
						onArchive: handleArchiveSession,
						onEditMeta: (sessionId) => setEditing({ sessionId }),
						draggingOver: dragOverCol === "__dph-sessions",
						onDragEnter: () => setDragOverCol("__dph-sessions"),
						onDragLeave: () => setDragOverCol((cur) => (cur === "__dph-sessions" ? null : cur)),
						onDrop: (e) => {
							const dt = e && e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
							const id = dt || dragId;
							if (id && id.indexOf("sess:") === 0) __dph_setSessionCol(id.slice(5), null);
							setDragId(null);
							setDragOverCol(null);
						},
						onDragStart: (id) => { setDragId(id); },
						onDragEnd: () => { setDragId(null); setDragOverCol(null); }
					}),
					__dph_COLUMNS.map((col) => __dph_h(__dph_Column, {
						key: col.id,
						col,
						sessions: visibleInCol(col.id),
						currentId: sessionCurrent,
						onOpen: handleOpenSession,
						onArchive: handleArchiveSession,
						onEditMeta: (sessionId) => setEditing({ sessionId }),
						draggingOver: dragOverCol === col.id,
						onDragStart: (id) => { setDragId(id); },
						onDragEnd: () => { setDragId(null); setDragOverCol(null); },
						onDragEnter: () => setDragOverCol(col.id),
						onDragLeave: () => setDragOverCol((cur) => (cur === col.id ? null : cur)),
						onDrop: (e) => {
							const dt = e && e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
							const id = dt || dragId;
							if (id && id.indexOf("sess:") === 0) __dph_setSessionCol(id.slice(5), col.id);
							setDragId(null);
							setDragOverCol(null);
						}
					})),
				// 备注编辑弹窗
				editing ? __dph_h(__dph_SessionMetaEditor, {
					sessionId: editing.sessionId,
					title: sessionTitleById[editing.sessionId] || editing.sessionId,
					meta: __dph_sessionMeta[editing.sessionId] || {},
					onSave: (meta) => handleSaveMeta(editing.sessionId, meta),
					onCancel: () => setEditing(null)
				}) : null,
				// 回收站（已删除会话）
				trashOpen ? __dph_h(__dph_TrashPanel, { onClose: () => setTrashOpen(false) }) : null,
				// 新建会话对话框
				createOpen ? __dph_h(__dph_CreateSessionDialog, {
					currentId: sessionCurrent,
					sessions: __dph_svc.sessions,
					workspaces: workspacesSnap,
					onDone: (info) => {
						setCreateOpen(false);
						if (info) window.alert(info);
					},
					onCancel: () => setCreateOpen(false)
				}) : null,
				// 导出：选择会话
				exportOpen ? __dph_h(__dph_ExportPicker, {
					sessions: sessions.map((s) => ({ id: s.id, title: (s.displayTitle || s.title || s.id) + (s.id === sessionCurrent ? "（当前）" : ""), cwd: s.cwd || "" })),
					onCancel: () => setExportOpen(false),
					onExport: (ids) => {
						const ok = doExport(ids);
						if (ok) setExportOpen(false);
					}
				}) : null))),
		document.body);
}

// 状态列：只显示会话卡片（拖拽换列，无列内排序）
function __dph_Column({ col, sessions, currentId, onOpen, onArchive, onEditMeta, draggingOver, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDrop }) {
	return __dph_h("div", { className: "dph-tb-col" },
		__dph_h("div", { className: "dph-tb-col-head" },
			__dph_h("span", { className: "dph-tb-col-dot", style: { background: col.accent } }),
			__dph_h("span", { className: "dph-tb-col-title" }, col.title),
			__dph_h("span", { className: "dph-tb-col-count" }, String(sessions.length)),
			__dph_h("span", { className: "dph-tb-col-spacer" })),
		__dph_h("div", {
			className: "dph-tb-col-body" + (draggingOver ? " dph-tb-col-body-over" : ""),
			onDragOver: (e) => { e.preventDefault(); onDragEnter(); },
			onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) onDragLeave(); },
			onDrop: (e) => { e.preventDefault(); onDrop(); }
		},
			sessions.length === 0
				? __dph_h("div", { className: "dph-tb-col-empty" }, draggingOver ? "松开以移动到这里" : "暂无会话")
				: sessions.map((s) => __dph_h(__dph_SessionCard, {
					key: s.id,
					session: s,
					meta: __dph_sessionMeta[s.id] || null,
					isCurrent: s.id === currentId,
					onOpen,
					onArchive,
					onEditMeta,
					onDragStart: () => onDragStart("sess:" + s.id),
					onDragEnd
				}))));
}

// 会话列（未归类会话）
function __dph_SessionColumn({ sessions, currentId, onOpen, onArchive, onEditMeta, draggingOver, onDragEnter, onDragLeave, onDrop, onDragStart, onDragEnd }) {
	return __dph_h("div", { className: "dph-tb-col dph-tb-session-col" },
		__dph_h("div", { className: "dph-tb-col-head" },
			__dph_h("span", { className: "dph-tb-col-dot", style: { background: "#4f7cff" } }),
			__dph_h("span", { className: "dph-tb-col-title" }, "会话"),
			__dph_h("span", { className: "dph-tb-col-count" }, String(sessions.length)),
			__dph_h("span", { className: "dph-tb-col-spacer" })),
		__dph_h("div", {
			className: "dph-tb-col-body" + (draggingOver ? " dph-tb-col-body-over" : ""),
			onDragOver: (e) => { e.preventDefault(); onDragEnter(); },
			onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) onDragLeave(); },
			onDrop: (e) => { e.preventDefault(); onDrop(); }
		},
			sessions.length === 0
				? __dph_h("div", { className: "dph-tb-col-empty" }, draggingOver ? "松开以移回会话列" : "暂无会话")
				: sessions.map((s) => __dph_h(__dph_SessionCard, {
					key: s.id,
					session: s,
					meta: __dph_sessionMeta[s.id] || null,
					isCurrent: s.id === currentId,
					onOpen,
					onArchive,
					onEditMeta,
					onDragStart: () => onDragStart("sess:" + s.id),
					onDragEnd
				}))));
}

// 会话卡片：标题/状态/cwd + 备注（优先级/标签/描述）+ 操作（进入/备注/删除）
function __dph_SessionCard({ session, meta, isCurrent, onOpen, onArchive, onEditMeta, onDragStart, onDragEnd }) {
	const title = session.displayTitle || session.title || session.id;
	const sessCol = __dph_sessionCols[session.id];
	const sessColMeta = __dph_COLUMNS.find((k) => k.id === sessCol);
	const accent = sessColMeta ? sessColMeta.accent : "#4f7cff";
	const prio = __dph_PRIORITIES.find((p) => p.id === (meta && meta.priority)) || null;
	const handleDelete = (e) => {
		e.stopPropagation();
		if (isCurrent) return;
		if (!window.confirm(`确定删除会话「${title}」吗？\n删除后该会话进入回收站，可恢复。`)) return;
		if (onArchive) onArchive(session.id);
	};
	const handleEnter = (e) => {
		e.stopPropagation();
		if (onOpen) onOpen(session.id);
	};
	const handleEditMeta = (e) => {
		e.stopPropagation();
		if (onEditMeta) onEditMeta(session.id);
	};
	return __dph_h("div", {
		className: "dph-tb-card dph-tb-card-session" + (isCurrent ? " dph-tb-session-current" : ""),
		title: (isCurrent ? "当前会话" : "会话") + "（点击进入，拖拽到状态列归类）",
		draggable: true,
		style: { "--dph-sess-accent": accent, borderLeftColor: accent },
		onClick: handleEnter,
		onDragStart: (e) => {
			if (e.target && typeof e.target.closest === "function" && e.target.closest("button")) { e.preventDefault(); return; }
			e.dataTransfer.setData("text/plain", "sess:" + session.id);
			e.dataTransfer.effectAllowed = "move";
			if (onDragStart) onDragStart();
		},
		onDragEnd
	},
		__dph_h("div", { className: "dph-tb-card-top" },
			__dph_h("span", { className: "dph-tb-card-title" }, "💬 " + title),
			session.running ? __dph_h("span", { className: "dph-tb-live" }, "处理中") : null,
			isCurrent ? __dph_h("span", { className: "dph-tb-card-prio dph-tb-session-badge", style: { color: "#4f7cff", borderColor: "#4f7cff" } }, "当前") : null),
		(prio || (meta && meta.labels && meta.labels.length))
			? __dph_h("div", { className: "dph-tb-card-labels" },
				prio ? __dph_h("span", { className: "dph-tb-card-prio", style: { color: prio.color, borderColor: prio.color } }, prio.label) : null,
				(meta && meta.labels || []).map((l, i) => __dph_h("span", { key: i, className: "dph-tb-card-label" }, l)))
			: null,
		(meta && meta.description)
			? __dph_h("div", { className: "dph-tb-card-desc" }, meta.description)
			: null,
		session.cwd ? __dph_h("div", { className: "dph-tb-card-desc dph-tb-card-cwd" }, session.cwd) : null,
		__dph_h("div", { className: "dph-tb-card-foot" },
			__dph_h("span", { className: "dph-tb-card-time" },
				__dph_fmtTime(session.updatedAt)),
			__dph_h("span", { className: "dph-tb-card-actions" },
				__dph_h("button", { type: "button", className: "dph-tb-mini dph-tb-enter", title: "进入该会话", onClick: handleEnter }, "↗"),
				__dph_h("button", { type: "button", className: "dph-tb-mini", title: "编辑备注", onClick: handleEditMeta }, "✎"),
				__dph_h("button", { type: "button", className: "dph-tb-mini dph-tb-mini-danger", title: isCurrent ? "当前会话不能删除" : "删除（进回收站）", disabled: isCurrent, onClick: handleDelete }, "🗑"))));
}

// 会话备注编辑弹窗：会话名只读，编辑描述/优先级/标签
function __dph_SessionMetaEditor({ sessionId, title, meta, onSave, onCancel }) {
	const [desc, setDesc] = __dph_react.useState((meta && meta.description) || "");
	const [priority, setPriority] = __dph_react.useState((meta && meta.priority) || "");
	const [labels, setLabels] = __dph_react.useState((meta && meta.labels || []).join(", "));
	const submit = (e) => {
		e.preventDefault();
		onSave({
			description: desc,
			priority,
			labels: labels.split(",").map((s) => s.trim()).filter(Boolean)
		});
	};
	return __dph_react_dom.createPortal(
		__dph_h("div", { className: "dph-tb-modal", onMouseDown: (e) => { if (e.target === e.currentTarget) onCancel(); } },
			__dph_h("form", { className: "dph-tb-modal-card", onSubmit: submit },
				__dph_h("div", { className: "dph-tb-modal-title" }, "会话备注"),
				__dph_h("div", { className: "dph-tb-session-editor-title" }, "💬 " + title),
				__dph_h("label", { className: "dph-tb-field" },
					__dph_h("span", { className: "dph-tb-field-label" }, "描述"),
					__dph_h("textarea", { className: "dph-tb-input dph-tb-textarea", rows: 4, value: desc, placeholder: "这个会话在做什么？（可选）", onChange: (e) => setDesc(e.target.value) })),
				__dph_h("div", { className: "dph-tb-row" },
					__dph_h("label", { className: "dph-tb-field dph-tb-field-half" },
						__dph_h("span", { className: "dph-tb-field-label" }, "优先级"),
						__dph_h("select", { className: "dph-tb-input", value: priority, onChange: (e) => setPriority(e.target.value) },
							__dph_h("option", { value: "" }, "（无）"),
							__dph_PRIORITIES.map((p) => __dph_h("option", { key: p.id, value: p.id }, p.label)))),
					__dph_h("label", { className: "dph-tb-field dph-tb-field-half" },
						__dph_h("span", { className: "dph-tb-field-label" }, "标签（逗号分隔）"),
						__dph_h("input", { className: "dph-tb-input", value: labels, placeholder: "如：前端, 紧急", onChange: (e) => setLabels(e.target.value) }))),
				__dph_h("div", { className: "dph-tb-modal-actions" },
					__dph_h("button", { type: "button", className: "dph-tb-btn", onClick: onCancel }, "取消"),
					__dph_h("button", { type: "submit", className: "dph-tb-btn dph-tb-btn-primary" }, "保存")))),
		document.body);
}

// 新建会话对话框：命名（可选）+ 放到哪个分组 + 选模型 + 推理强度 + 开始消息（让会话脱离空白、出现在侧边栏）
function __dph_CreateSessionDialog({ currentId, sessions, workspaces, onDone, onCancel }) {
	const [title, setTitle] = __dph_react.useState("");
	const [effort, setEffort] = __dph_react.useState(""); // "" = 默认
	const [startMsg, setStartMsg] = __dph_react.useState("你好，请简要确认你已就绪。");
	const [sendStart, setSendStart] = __dph_react.useState(true); // 默认发送（让会话出现在侧边栏）
	const [groupChoice, setGroupChoice] = __dph_react.useState("auto"); // "auto" | workspaceId | "new"
	const [newGroupPath, setNewGroupPath] = __dph_react.useState("");
	const [models, setModels] = __dph_react.useState(null); // { current, groups }
	const [modelsStatus, setModelsStatus] = __dph_react.useState("loading"); // loading | ok | error:msg | no-svc
	const [selected, setSelected] = __dph_react.useState(null); // { provider, model }
	const [busy, setBusy] = __dph_react.useState(false);
	// 已有分组（workspace 列表，来自侧边栏快照）
	const workspaceItems = workspaces && Array.isArray(workspaces.items) ? workspaces.items : [];
	// 当前会话所在分组（供「跟随当前会话」默认值）
	const currentWs = workspaceItems.find((w) => currentId && Array.isArray(w.sessionIds) && w.sessionIds.includes(currentId)) || null;
	const pickNewGroupDir = async () => {
		if (!__dph_svc.workspaces || typeof __dph_svc.workspaces.pickDirectory !== "function") { window.alert("目录选择不可用"); return; }
		try {
			const p = await __dph_svc.workspaces.pickDirectory();
			if (p) setNewGroupPath(p);
		} catch (err) { window.alert("选择目录失败：" + (err && err.message ? err.message : String(err))); }
	};

	// 加载可用模型目录（用当前会话查询，目录为全局）
	__dph_react.useEffect(() => {
		// 模型目录走 connection.api.sessions（RPC 网关），sessions 服务不提供
		if (!__dph_svc.connection) { setModelsStatus("error:connection 服务未注入"); return; }
		if (!__dph_svc.connection.api) { setModelsStatus("error:connection.api 缺失"); return; }
		const api = __dph_svc.connection.api.sessions;
		if (!api) { setModelsStatus("error:connection.api.sessions 缺失"); return; }
		if (typeof api.models !== "function") { setModelsStatus("error:api.sessions.models 缺失（可用方法: " + Object.keys(api).slice(0, 10).join(",") + "）"); return; }
		// 用当前会话查询模型目录（目录为全局）；无当前会话时用列表里任意会话兜底
		let queryId = currentId;
		if (!queryId) {
			try {
				const snap = sessions && sessions.list ? sessions.list.getSnapshot() : null;
				const first = snap && snap.byId ? Object.keys(snap.byId).find((id) => { const s = snap.byId[id]; return s && s.origin !== "subagent"; }) : null;
				if (first) queryId = first;
			} catch (err) { /* noop */ }
		}
		if (!queryId) { setModelsStatus("error:暂无会话，无法查询模型目录（创建后将使用默认模型）"); return; }
		let alive = true;
		setModelsStatus("loading");
		api.models({ sessionId: queryId }).then((raw) => {
			if (!alive) return;
			const res = raw && raw.result ? raw.result : raw;
			if (!res || !res.ok) {
				const msg = res && res.error && (res.error.message || res.error.code) ? (res.error.message || res.error.code) : "未知错误";
				setModelsStatus("error:" + msg);
				return;
			}
			if (!res.value) { setModelsStatus("error:返回缺少 value"); return; }
			setModels(res.value);
			setModelsStatus("ok");
			if (res.value.current) setSelected({ provider: res.value.current.provider, model: res.value.current.model });
		}).catch((err) => { if (alive) setModelsStatus("error:" + (err && err.message ? err.message : String(err))); });
		return () => { alive = false; };
	}, [sessions, currentId]);

	// 目录结构：provider = group.id，model = model.id（显示名 model.name）
	const modelOptions = models && models.groups
		? models.groups.flatMap((g) => (g.models || []).map((m) => ({ provider: g.id, model: m.id, label: (m.name || m.id) })))
		: [];
	const currentLabel = models && models.current ? (models.current.provider + " / " + models.current.model) : "";

	const submit = async (e) => {
		e.preventDefault();
		if (busy) return;
		if (!sessions || typeof sessions.create !== "function") { window.alert("新建会话失败：会话服务不可用"); return; }
		setBusy(true);
		const notes = [];
		try {
			// 1) 创建（返回 sessionId 字符串）：按「放到哪个分组」决定归属
			let created;
			if (groupChoice === "new") {
				// 新建分组：先注册 workspace（目录需已存在），再创建会话挂入
				if (!newGroupPath.trim()) { window.alert("请先选择或输入新分组的目录路径"); setBusy(false); return; }
				if (!__dph_svc.workspaces || typeof __dph_svc.workspaces.create !== "function") { window.alert("新建会话失败：工作区服务不可用"); setBusy(false); return; }
				const ws = await __dph_svc.workspaces.create({ path: newGroupPath.trim() });
				if (!ws || !ws.workspaceId) throw new Error("新建分组未返回 workspaceId");
				created = await sessions.create({ workspaceId: ws.workspaceId });
			} else if (groupChoice !== "auto") {
				// 已有分组：挂入指定 workspace（不新建分组）
				created = await sessions.create({ workspaceId: groupChoice });
			} else if (currentWs) {
				// 跟随当前会话所在分组
				created = await sessions.create({ workspaceId: currentWs.workspaceId });
			} else {
				// 不指定：落到未分组（Ungrouped），不新建分组
				created = await sessions.create({});
			}
			let sessionId = null;
			if (typeof created === "string" && created) sessionId = created;
			else if (created && created.value && created.value.sessionId) sessionId = created.value.sessionId;
			if (!sessionId) throw new Error("会话已创建，但未返回 ID；请刷新页面确认（可在侧边栏查看）");
			// 2) 记录新建（看板显示「新」标记）
			if (!__dph_newSessions.includes(sessionId)) { __dph_newSessions.push(sessionId); __dph_persist(); }
			// 3) 选模型 / 推理强度（effort 非空时必须调用 selectModel，否则推理强度设置无效）
			if ((selected && selected.provider && models && models.current && (selected.provider !== models.current.provider || selected.model !== models.current.model)) || (effort && models && models.current)) {
				try {
					const api = __dph_svc.connection && __dph_svc.connection.api && __dph_svc.connection.api.sessions;
					if (!api || typeof api.selectModel !== "function") { notes.push("指定模型/推理强度不可用"); }
					else {
						const target = selected && selected.provider ? selected : { provider: models.current.provider, model: models.current.model };
						const sr = await api.selectModel({ sessionId, provider: target.provider, model: target.model, ...(effort ? { reasoningEffort: effort } : {}) });
						const rr = sr && sr.result ? sr.result : sr;
						if (rr && rr.ok) notes.push(effort ? ("已指定模型 " + target.provider + " / " + target.model + "（推理强度 " + effort + "）") : ("已指定模型 " + target.provider + " / " + target.model));
						else notes.push("指定模型失败：" + ((rr && rr.error && rr.error.message) || "未知"));
					}
				} catch (err) { notes.push("指定模型失败：" + (err && err.message ? err.message : String(err))); }
			}
			// 4) 命名
			if (title.trim()) {
				try {
					const sess = sessions.binding && sessions.binding(sessionId) ? sessions.binding(sessionId).session : null;
					if (sess && typeof sess.rename === "function") { await sess.rename(title.trim()); notes.push("已命名"); }
					else notes.push("命名不可用");
				} catch (err) { notes.push("命名失败：" + (err && err.message ? err.message : String(err))); }
			}
			// 5) 开始消息（发送后脱离空白 → 侧边栏出现）
			if (sendStart && startMsg.trim()) {
				try {
					const sess = sessions.binding && sessions.binding(sessionId) ? sessions.binding(sessionId).session : null;
					if (sess && typeof sess.prompt === "function") {
						await sess.prompt([{ type: "text", text: startMsg.trim() }], "queue");
						notes.push("开始消息已发送，侧边栏将出现该会话");
					} else notes.push("发送开始消息不可用");
				} catch (err) { notes.push("发送开始消息失败：" + (err && err.message ? err.message : String(err))); }
			}
			onDone(notes.length ? "已新建会话。" + notes.join("；") : "已新建会话。");
		} catch (err) {
			window.alert("新建会话失败：" + (err && err.message ? err.message : String(err)));
			setBusy(false);
		}
	};

	return __dph_react_dom.createPortal(
		__dph_h("div", { className: "dph-tb-modal", onMouseDown: (e) => { if (e.target === e.currentTarget) onCancel(); } },
			__dph_h("form", { className: "dph-tb-modal-card", onSubmit: submit },
				__dph_h("div", { className: "dph-tb-modal-title" }, "新建会话"),
				__dph_h("label", { className: "dph-tb-field" },
					__dph_h("span", { className: "dph-tb-field-label" }, "名称（可选）"),
					__dph_h("input", { className: "dph-tb-input", value: title, placeholder: "给这个会话起个名字", onChange: (e) => setTitle(e.target.value) })),
				__dph_h("label", { className: "dph-tb-field" },
					__dph_h("span", { className: "dph-tb-field-label" }, "放到哪个分组" + (currentWs ? "（当前会话在「" + currentWs.title + "」）" : "")),
					__dph_h("select", { className: "dph-tb-input", value: groupChoice, onChange: (e) => setGroupChoice(e.target.value) },
						__dph_h("option", { value: "auto" }, currentWs ? "（跟随当前会话：" + currentWs.title + "）" : "（不指定，归入未分组）"),
						workspaceItems.map((w) => __dph_h("option", { key: w.workspaceId, value: w.workspaceId }, w.title + (w.path ? "（" + w.path + "）" : ""))),
						__dph_h("option", { value: "new" }, "＋ 新建分组（选择目录）…")),
					groupChoice === "new"
						? __dph_h("div", { className: "dph-tb-row" },
							__dph_h("input", { className: "dph-tb-input", value: newGroupPath, placeholder: "选择或输入新分组的目录路径", onChange: (e) => setNewGroupPath(e.target.value) }),
							__dph_h("button", { type: "button", className: "dph-tb-btn", onClick: pickNewGroupDir }, "选择目录"))
						: null),
				__dph_h("label", { className: "dph-tb-field" },
					__dph_h("span", { className: "dph-tb-field-label" }, "模型" + (currentLabel ? "（当前默认 " + currentLabel + "）" : "")),
					__dph_h("select", { className: "dph-tb-input", value: selected ? selected.provider + "|" + selected.model : "", disabled: !models, onChange: (e) => {
						const [provider, model] = e.target.value.split("|");
						setSelected(provider && model ? { provider, model } : null);
					} },
						__dph_h("option", { value: "" }, models ? "（默认）" : (modelsStatus.indexOf("error:") === 0 ? "加载失败：" + modelsStatus.slice(6) : modelsStatus === "no-svc" ? "模型服务不可用" : "加载中…")),
						modelOptions.map((m) => __dph_h("option", { key: m.provider + "|" + m.model, value: m.provider + "|" + m.model }, m.label)))),
				__dph_h("label", { className: "dph-tb-field" },
					__dph_h("span", { className: "dph-tb-field-label" }, "推理强度（可选）"),
					__dph_h("select", { className: "dph-tb-input", value: effort, onChange: (e) => setEffort(e.target.value) },
						__dph_h("option", { value: "" }, "（默认）"),
						__dph_h("option", { value: "low" }, "低"),
						__dph_h("option", { value: "medium" }, "中"),
						__dph_h("option", { value: "high" }, "高"))),
				__dph_h("label", { className: "dph-tb-field" },
					__dph_h("span", { className: "dph-tb-field-label" }, "开始消息（发送后会话出现在侧边栏）"),
					__dph_h("textarea", { className: "dph-tb-input dph-tb-textarea", rows: 2, value: startMsg, onChange: (e) => setStartMsg(e.target.value) })),
				__dph_h("label", { className: "dph-tb-check" },
					__dph_h("input", { type: "checkbox", checked: sendStart, onChange: (e) => setSendStart(e.target.checked) }),
					__dph_h("span", { className: "dph-tb-check-label" }, "创建后发送开始消息（不勾选则仅看板显示，侧边栏需手动进入发消息后出现）")),
				__dph_h("div", { className: "dph-tb-modal-actions" },
					__dph_h("button", { type: "button", className: "dph-tb-btn", onClick: onCancel }, "取消"),
					__dph_h("button", { type: "submit", className: "dph-tb-btn dph-tb-btn-primary", disabled: busy }, busy ? "创建中…" : "创建")))),
		document.body);
}

// 导出：打勾自由选择要导出的会话
function __dph_ExportPicker({ sessions, onCancel, onExport }) {
	const [checked, setChecked] = __dph_react.useState([]);
	const allChecked = sessions.length > 0 && checked.length === sessions.length;
	const toggle = (id) => setChecked((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
	const toggleAll = () => setChecked(allChecked ? [] : sessions.map((s) => s.id));
	return __dph_react_dom.createPortal(
		__dph_h("div", { className: "dph-tb-modal", onMouseDown: (e) => { if (e.target === e.currentTarget) onCancel(); } },
			__dph_h("div", { className: "dph-tb-modal-card dph-tb-trash-card" },
				__dph_h("div", { className: "dph-tb-modal-title" }, "选择要导出的会话"),
				__dph_h("div", { className: "dph-tb-export-hint" }, "打勾自由选择（可多选）。文件将包含所选会话的信息及备注。"),
				__dph_h("div", { className: "dph-tb-session-picker dph-tb-export-list" },
					sessions.length === 0
						? __dph_h("div", { className: "dph-tb-trash-empty" }, "没有可导出的会话")
						: sessions.map((s) => __dph_h("label", { key: s.id, className: "dph-tb-check" },
							__dph_h("input", { type: "checkbox", checked: checked.includes(s.id), onChange: () => toggle(s.id) }),
							__dph_h("span", { className: "dph-tb-check-label" }, "💬 " + s.title),
							s.cwd ? __dph_h("span", { className: "dph-tb-export-cwd" }, s.cwd) : null))),
				__dph_h("div", { className: "dph-tb-modal-actions" },
					__dph_h("button", { type: "button", className: "dph-tb-btn", onClick: toggleAll }, allChecked ? "全不选" : "全选"),
					__dph_h("button", { type: "button", className: "dph-tb-btn", onClick: onCancel }, "取消"),
					__dph_h("button", {
						type: "button",
						className: "dph-tb-btn dph-tb-btn-primary",
						disabled: checked.length === 0,
						onClick: () => onExport(checked)
					}, `导出 ${checked.length > 0 ? checked.length + " 个会话" : "（未选择）"}`)))),
		document.body);
}

// 回收站：已删除（归档）的会话，可恢复（内存态恢复 → 刷新即生效）
function __dph_TrashPanel({ onClose }) {
	__dph_useLoaded();
	const sessionsSnap = __dph_useStore(__dph_svc.sessions ? __dph_svc.sessions.list : null);
	const wsSnap = __dph_useStore(__dph_svc.workspaces ? __dph_svc.workspaces.list : null);
	const archivedIds = wsSnap && Array.isArray(wsSnap.archivedSessionIds) ? wsSnap.archivedSessionIds : [];
	const archivedSessions = archivedIds.map((id) => (sessionsSnap && sessionsSnap.byId ? sessionsSnap.byId[id] : null)).filter(Boolean);
	const [restoring, setRestoring] = __dph_react.useState(null); // 正在恢复的 sessionId（防重复提交）
	const restoreSession = (sessionId) => {
		if (restoring) return;
		setRestoring(sessionId);
		fetch("/api/dph/taskboard/unarchive", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sessionId })
		}).then((r) => r.json()).then((d) => {
			setRestoring(null);
			if (d && d.ok) window.alert(d.requiresRestart ? "会话已恢复！重启 harness 后它会重新出现。" : "会话已恢复！它会重新出现在侧边栏和看板中。");
			else window.alert("恢复失败：" + ((d && d.error) || "未知错误"));
		}).catch((err) => { setRestoring(null); window.alert("恢复失败：" + (err && err.message ? err.message : String(err))); });
	};
	return __dph_react_dom.createPortal(
		__dph_h("div", { className: "dph-tb-modal", onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
			__dph_h("div", { className: "dph-tb-modal-card dph-tb-trash-card" },
				__dph_h("div", { className: "dph-tb-modal-title" }, `回收站（已删除会话 ${archivedSessions.length}）`),
				__dph_h("div", { className: "dph-tb-trash-list" },
					archivedSessions.length === 0
						? __dph_h("div", { className: "dph-tb-trash-empty" }, "回收站是空的")
						: archivedSessions.map((s) => {
							const st = s.displayTitle || s.title || s.id;
							return __dph_h("div", { key: "arch-" + s.id, className: "dph-tb-trash-item" },
								__dph_h("div", { className: "dph-tb-trash-main" },
									__dph_h("div", { className: "dph-tb-trash-title" }, "💬 " + st),
									__dph_h("div", { className: "dph-tb-trash-meta" }, "已删除（归档），可恢复")),
								__dph_h("div", { className: "dph-tb-trash-actions" },
									__dph_h("button", { type: "button", className: "dph-tb-btn", title: "恢复此会话", disabled: restoring === s.id, onClick: () => restoreSession(s.id) }, restoring === s.id ? "恢复中…" : "恢复")));
						})),
				__dph_h("div", { className: "dph-tb-modal-actions" },
					__dph_h("button", { type: "button", className: "dph-tb-btn dph-tb-btn-primary", onClick: onClose }, "关闭")))),
		document.body);
}

// ── 样式 ──────────────────────────────────────────────────────────────
const __dph_css_id = "@dph/taskboard/DPH-Taskboard.css";
const __dph_css = `
.dph-tb-overlay{box-sizing:border-box;background:rgba(8,10,14,.72);align-items:center;justify-content:center;padding:20px;position:fixed;inset:0;z-index:1200;display:flex}
.dph-tb-shell{box-sizing:border-box;width:min(1440px,100%);height:min(880px,100%);background:var(--dsw-alias-bg-base,#161a22);border:1px solid var(--dsw-alias-border-l2,#2a2f3a);box-shadow:var(--dsw-shadow-lv3,0 18px 56px rgba(0,0,0,.5));border-radius:16px;flex-direction:column;display:flex;overflow:hidden}
.dph-tb-head{flex:none;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l2,#2a2f3a);display:flex}
.dph-tb-head-title{color:var(--dsw-alias-label-primary,#e8eaf0);font-size:16px;font-weight:600;line-height:22px}
.dph-tb-head-count{color:var(--dsw-alias-label-caption,#7a8394);font-size:12px;line-height:18px}
.dph-tb-search{box-sizing:border-box;width:220px;height:30px;color:var(--dsw-alias-label-primary,#e8eaf0);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));border:1px solid var(--dsw-alias-border-l1,#232834);border-radius:8px;padding:0 10px;font-size:12px;outline:none}
.dph-tb-search:focus{border-color:var(--dsw-alias-state-business-primary,#4f7cff)}
.dph-tb-head-spacer{flex:1}
.dph-tb-btn{height:30px;color:var(--dsw-alias-label-secondary,#c8ccd4);cursor:pointer;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));border:1px solid var(--dsw-alias-border-l1,#232834);border-radius:8px;padding:0 12px;font-size:12px;line-height:28px;white-space:nowrap}
.dph-tb-btn:hover{background:var(--dsw-alias-button-floating-hover,rgba(255,255,255,.12))}
.dph-tb-btn-primary{color:#fff;background:var(--dsw-alias-state-business-primary,#4f7cff);border-color:transparent}
.dph-tb-btn-primary:hover{background:var(--dsw-alias-state-business-primary,#4f7cff);filter:brightness(1.08)}
.dph-tb-btn:disabled{opacity:.45;cursor:default}
.dph-tb-close{min-width:30px;padding:0}
.dph-tb-cols{flex:1;min-height:0;align-items:flex-start;gap:12px;padding:14px 18px 18px;display:flex;overflow:auto}
.dph-tb-col{box-sizing:border-box;width:292px;flex:none;max-height:100%;background:var(--dsw-specific-menu,#1c212b);border:1px solid var(--dsw-alias-border-l1,#232834);border-radius:12px;flex-direction:column;display:flex;overflow:hidden}
.dph-tb-col-head{flex:none;align-items:center;gap:8px;padding:10px 12px 8px;display:flex}
.dph-tb-col-dot{width:8px;height:8px;flex:none;border-radius:50%}
.dph-tb-col-title{color:var(--dsw-alias-label-primary,#e8eaf0);font-size:13px;font-weight:600;line-height:20px}
.dph-tb-col-count{color:var(--dsw-alias-label-caption,#7a8394);font-size:12px;line-height:18px}
.dph-tb-col-spacer{flex:1}
.dph-tb-col-body{flex:1;min-height:60px;gap:8px;padding:4px 8px 10px;flex-direction:column;display:flex;overflow:auto}
.dph-tb-col-body-over{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));border-radius:8px;outline:2px dashed var(--dsw-alias-state-business-primary,#4f7cff);outline-offset:-2px}
.dph-tb-col-empty{color:var(--dsw-alias-label-caption,#7a8394);border:1px dashed var(--dsw-alias-border-l2,#2a2f3a);border-radius:10px;margin:2px;padding:18px 10px;font-size:12px;line-height:18px;text-align:center}
.dph-tb-card{box-sizing:border-box;color:var(--dsw-alias-label-primary,#e8eaf0);cursor:grab;background:var(--dsw-alias-bg-base,#161a22);border:1px solid var(--dsw-alias-border-l1,#232834);border-left-width:3px;border-radius:10px;padding:10px 12px;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.dph-tb-card:active{cursor:grabbing}
.dph-tb-card-session{cursor:grab;background:linear-gradient(180deg,color-mix(in srgb,var(--dph-sess-accent,#4f7cff) 9%,var(--dsw-alias-bg-base,#161a22)),var(--dsw-alias-bg-base,#161a22));border:1px solid var(--dph-sess-accent,#4f7cff);border-left-width:3px}
.dph-tb-card-session:active{cursor:grabbing}
.dph-tb-session-badge{background:rgba(79,124,255,.12)}
.dph-tb-session-col{width:340px;flex:none}
.dph-tb-session-current{border-color:var(--dph-sess-accent,#4f7cff);box-shadow:0 0 0 1px var(--dph-sess-accent,#4f7cff),0 2px 10px color-mix(in srgb,var(--dph-sess-accent,#4f7cff) 30%,transparent)}
.dph-tb-live{flex:none;align-items:center;gap:5px;color:var(--dsw-alias-state-business-primary,#4f7cff);font-size:11px;line-height:16px;display:flex;white-space:nowrap}
.dph-tb-live::before{content:"";width:7px;height:7px;flex:none;background:currentColor;border-radius:50%;animation:dph-tb-breathe 1.2s ease-in-out infinite}
@keyframes dph-tb-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}
.dph-tb-card-top{flex:none;align-items:flex-start;gap:8px;display:flex}
.dph-tb-card-title{flex:1;min-width:0;font-size:13px;font-weight:600;line-height:19px;overflow-wrap:anywhere}
.dph-tb-card-prio{flex:none;font-size:10px;line-height:16px;border:1px solid;border-radius:6px;padding:0 5px;white-space:nowrap}
.dph-tb-card-labels{flex:none;gap:4px;margin-top:6px;flex-wrap:wrap;display:flex}
.dph-tb-card-label{color:var(--dsw-alias-label-secondary,#c8ccd4);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));border-radius:5px;padding:1px 6px;font-size:11px;line-height:16px}
.dph-tb-card-desc{color:var(--dsw-alias-label-secondary,#c8ccd4);margin-top:6px;font-size:12px;line-height:18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dph-tb-card-cwd{color:var(--dsw-alias-label-caption,#7a8394);font-size:11px;line-height:16px;-webkit-line-clamp:1}
.dph-tb-card-foot{flex:none;align-items:center;gap:6px;margin-top:8px;display:flex}
.dph-tb-card-time{flex:1;min-width:0;color:var(--dsw-alias-label-caption,#7a8394);font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dph-tb-card-actions{flex:none;gap:2px;display:flex;opacity:1}
.dph-tb-mini{width:22px;height:22px;color:var(--dsw-alias-label-tertiary,#9aa3b2);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:0;font-size:11px;line-height:22px}
.dph-tb-mini:hover:not(:disabled){color:var(--dsw-alias-label-primary,#e8eaf0);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dph-tb-mini:disabled{opacity:.3;cursor:default}
.dph-tb-mini-danger:hover:not(:disabled){color:#e5534b}
.dph-tb-enter{color:var(--dsw-alias-state-business-primary,#4f7cff);font-size:13px}
.dph-tb-enter:hover:not(:disabled){color:var(--dsw-alias-state-business-primary,#4f7cff);background:rgba(79,124,255,.16)}
.dph-tb-modal{box-sizing:border-box;background:rgba(8,10,14,.6);align-items:center;justify-content:center;padding:20px;position:fixed;inset:0;z-index:1300;display:flex}
.dph-tb-modal-card{box-sizing:border-box;width:min(480px,100%);color:var(--dsw-alias-label-primary,#e8eaf0);background:var(--dsw-specific-menu,#1c212b);border:1px solid var(--dsw-alias-border-l2,#2a2f3a);box-shadow:var(--dsw-shadow-lv3,0 18px 56px rgba(0,0,0,.5));border-radius:14px;gap:12px;padding:18px;flex-direction:column;display:flex}
.dph-tb-modal-title{font-size:15px;font-weight:600;line-height:22px}
.dph-tb-session-editor-title{color:var(--dsw-alias-label-primary,#e8eaf0);font-size:14px;font-weight:600;line-height:20px;overflow-wrap:anywhere}
.dph-tb-field{flex:none;gap:6px;flex-direction:column;display:flex}
.dph-tb-field-half{flex:1;min-width:0}
.dph-tb-row{flex:none;gap:12px;display:flex}
.dph-tb-field-label{color:var(--dsw-alias-label-secondary,#c8ccd4);font-size:12px;line-height:18px}
.dph-tb-input{box-sizing:border-box;width:100%;height:32px;color:var(--dsw-alias-label-primary,#e8eaf0);background:var(--dsw-alias-bg-base,#161a22);border:1px solid var(--dsw-alias-border-l1,#232834);border-radius:8px;padding:0 10px;font-size:13px;font-family:inherit;outline:none}
.dph-tb-input:focus{border-color:var(--dsw-alias-state-business-primary,#4f7cff)}
.dph-tb-textarea{height:auto;padding:8px 10px;resize:vertical;line-height:18px}
.dph-tb-modal-actions{flex:none;justify-content:flex-end;gap:8px;margin-top:4px;display:flex}
.dph-tb-btn-danger{color:#e5534b;border-color:color-mix(in srgb,#e5534b 45%,transparent)}
.dph-tb-btn-danger:hover{background:rgba(229,83,75,.14)}
.dph-tb-trash-card{width:min(560px,100%)}
.dph-tb-trash-list{max-height:50vh;gap:8px;flex-direction:column;display:flex;overflow:auto}
.dph-tb-trash-empty{color:var(--dsw-alias-label-caption,#7a8394);padding:24px 0;font-size:13px;text-align:center}
.dph-tb-trash-item{box-sizing:border-box;align-items:center;gap:10px;background:var(--dsw-alias-bg-base,#161a22);border:1px solid var(--dsw-alias-border-l1,#232834);border-radius:10px;padding:10px 12px;display:flex}
.dph-tb-trash-main{flex:1;min-width:0}
.dph-tb-trash-title{color:var(--dsw-alias-label-primary,#e8eaf0);font-size:13px;font-weight:600;line-height:19px;overflow-wrap:anywhere}
.dph-tb-trash-meta{color:var(--dsw-alias-label-caption,#7a8394);margin-top:2px;font-size:11px;line-height:16px}
.dph-tb-trash-actions{flex:none;gap:6px;display:flex}
.dph-tb-trash-actions .dph-tb-btn{height:26px;line-height:24px;padding:0 10px}
.dph-tb-session-picker{box-sizing:border-box;max-height:168px;gap:2px;background:var(--dsw-alias-bg-base,#161a22);border:1px solid var(--dsw-alias-border-l1,#232834);border-radius:8px;padding:6px 8px;flex-direction:column;display:flex;overflow:auto}
.dph-tb-check{align-items:center;gap:8px;border-radius:6px;padding:4px 6px;font-size:13px;line-height:20px;display:flex;cursor:pointer}
.dph-tb-check:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dph-tb-check input{width:14px;height:14px;flex:none;accent-color:var(--dsw-alias-state-business-primary,#4f7cff);cursor:pointer}
.dph-tb-check-label{min-width:0;color:var(--dsw-alias-label-primary,#e8eaf0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dph-tb-export-list{max-height:300px}
.dph-tb-export-hint{color:var(--dsw-alias-label-caption,#7a8394);font-size:12px;line-height:18px}
.dph-tb-export-cwd{min-width:0;color:var(--dsw-alias-label-caption,#7a8394);margin-left:auto;font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dph-tb-searchbtn{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}
.dph-tb-searchbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dph-tb-searchbtn-rail{width:36px;height:36px;color:var(--dsw-alias-label-primary)}
.dph-tb-searchbtn-rail:hover{background:var(--dsw-alias-interactive-bg-hover)}
`;
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(__dph_css_id) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "@dph/taskboard";
	tag.dataset.pluginCss = __dph_css_id;
	tag.textContent = __dph_css;
	document.head.appendChild(tag);
}

// ── 插件入口：捕获服务 + 挂载到 ui-workspace 提供的锚点 ─────────────────
const inject = ["sessions", "workspaces", "connection"];
let __dph_mounted = false;
let __dph_observer = null;
function __dph_mountAll() {
	if (typeof document === "undefined") return;
	const mounts = document.querySelectorAll("[data-dph-taskboard-mount]");
	if (mounts.length === 0) {
		console.warn("[dph-taskboard] 未找到挂载点 [data-dph-taskboard-mount]（ui-workspace 补丁未生效？）");
		return;
	}
	if (__dph_createRoot) {
		for (const el of mounts) {
			if (el.__dphRoot) continue;
			const root = __dph_createRoot(el);
			root.render(__dph_h(__dph_TaskBoardButton, { rail: el.hasAttribute("data-dph-taskboard-rail") }));
			el.__dphRoot = root;
		}
		__dph_mounted = true;
		return;
	}
	if (typeof __dph_react_dom.render === "function") {
		for (const el of mounts) {
			if (el.__dphRoot) continue;
			__dph_react_dom.render(__dph_h(__dph_TaskBoardButton, { rail: el.hasAttribute("data-dph-taskboard-rail") }), el);
			el.__dphRoot = { unmount: () => { try { __dph_react_dom.unmountComponentAtNode(el); } catch (err) { /* noop */ } } };
		}
		__dph_mounted = true;
	}
}
function __dph_watchMounts() {
	if (typeof document === "undefined") return;
	const tryObserve = () => {
		if (!document.body) return false;
		__dph_mountAll();
		if (typeof MutationObserver !== "function") {
			setInterval(() => __dph_mountAll(), 1000);
			return true;
		}
		if (__dph_observer) return true;
		__dph_observer = new MutationObserver(() => __dph_mountAll());
		__dph_observer.observe(document.body, { childList: true, subtree: true });
		return true;
	};
	if (!tryObserve()) {
		document.addEventListener("DOMContentLoaded", tryObserve);
	}
}
function apply(ctx) {
	console.log("[dph-taskboard] apply, sessions:", !!(ctx && ctx.sessions), "workspaces:", !!(ctx && ctx.workspaces));
	try {
		if (ctx && ctx.sessions) __dph_svc.sessions = ctx.sessions;
		if (ctx && ctx.workspaces) __dph_svc.workspaces = ctx.workspaces;
		if (ctx && ctx.connection) __dph_svc.connection = ctx.connection;
	} catch (err) { console.error("[dph-taskboard] 捕获服务失败：", err); }
	// 插件重载（HMR）时：清理旧挂载点 root，确保新代码全量重挂
	if (typeof document !== "undefined") {
		for (const el of document.querySelectorAll("[data-dph-taskboard-mount]")) {
			if (el.__dphRoot) {
				try { el.__dphRoot.unmount(); } catch (err) { /* noop */ }
				el.__dphRoot = null;
			}
		}
		__dph_mounted = false;
	}
	if (!__dph_mounted) __dph_watchMounts();
	// 订阅会话/工作区变化：外部操作（侧边栏新建/重命名/归档、Agent 动作）也会刷新宿主快照
	const stores = [];
	if (__dph_svc.sessions && __dph_svc.sessions.list && typeof __dph_svc.sessions.list.subscribe === "function") stores.push(__dph_svc.sessions.list);
	if (__dph_svc.workspaces && __dph_svc.workspaces.list && typeof __dph_svc.workspaces.list.subscribe === "function") stores.push(__dph_svc.workspaces.list);
	for (const store of stores) {
		try { store.subscribe(() => __dph_scheduleSync()); } catch (err) { /* noop */ }
	}
	// 初始同步：插件激活后主动把当前看板快照同步到宿主（Agent 可立即读到现状）
	__dph_scheduleSync();
}

// 测试钩子（冒烟测试用；运行时无副作用）
exports.__dphTaskBoardButton = __dph_TaskBoardButton;
exports.__dphTaskBoardOverlay = __dph_TaskBoardOverlay;
exports.apply = apply;
exports.inject = inject;
//#endregion ══════════════════════ DPH TASKBOARD CLIENT END ══════════════════════
