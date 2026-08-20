# Agent Note: Trellis 对话优先外壳恢复

Status: implemented

[English](2026-08-19-trellis-chat-first-shell.md) | 中文

## Problem

早期迭代用独立 Trellis 界面（`ui-trellis-shell`）注册到内置 `root` 槽位，遮蔽了常规 DeepSeek Harness Web 外壳。由于单槽位中低优先级者胜出，布局插件不再渲染，中央对话输入框随之消失——用户丢失了最基本的 DeepSeek Chat 能力：与 Agent 对话、联网搜索，以及以对话为中心的资料收集。

## Decision

1. **移除 root 槽位遮蔽外壳。** 删除 `@deepseek-ai/dsh-client-ui-trellis-shell` 及其 profile 行、TypeScript 引用与 bundle 依赖。常规 `ui-layout` + `ui-conversation` 外壳重新渲染，中央对话输入框始终存在。
2. **Trellis UI 仅作为对话槽位插件保留。** `ui-trellis-graph` 继续作为 `trellis_graph` 的 keyed `tool.call.toolview` 渲染器；`ui-trellis-browser` 继续作为 `conversation.session.header.utilities` 抽屉；`ui-trellis-knowledge` 继续作为 `conversation.view` 标签页，并在输入框上方提供紧凑的 `conversation.input.dock`。任何 Trellis 界面都不再占用 root 槽位。
3. **对话优先收集。** `InputBar` 原生处理图片与文本文档；`dsh-file-upload` 负责 PDF/DOCX/XLSX 等二进制上传。vendor 客户端在 `<html>` 上设置 `data-dsh-file-upload`，`InputBar` 检测到后把非原生文件交给上传插件处理，避免重复摄取。Trellis 系统提示词把单独链接、`[Trellis document]` 块或已上传/`@` 引用的文件视为归档整理请求。
4. **为 Trellis profile 重新启用联网搜索。** 基础组合已提供基于 DeepSeek 原生搜索的 `web_search`；Trellis overlay 重新启用 `tool-web`，并保持 `fetch: false`（仅搜索，不允许任意目标抓取）。
5. **修复工作区构建。** `tsdown` 排除 vendor 目录下自带构建脚本的外部 DSH 插件（它们不遵循仓库 `lib/types` 约定），`pnpm build` 不再因这些包失败。
6. **数据诚实与 UI 打磨。** `TrellisKnowledgeView` 不再渲染硬编码示例文档，初始为空并从 `/api/trellis/knowledge` 轮询/刷新。知识库 dock、favicon、启动词标以及浏览器/知识库界面统一使用主题 token 与 Trellis 绿色强调色。

## Alternatives considered

- **保留独立外壳并嵌入第二个输入框。** 拒绝：两个输入面会分裂收集路径并争抢会话状态。
- **把 Trellis UI 只放进右侧详情栏。** 拒绝：知识库需要完整宽度展示台账、关系与图谱，对话视图标签页更合适，输入框 dock 覆盖紧凑场景。

## Consequences

- `pnpm trellis:web` 启动常规三栏对话外壳，Trellis 知识库作为对话视图标签页，知识 dock 位于输入框上方。
- 粘贴链接或文本文档、拖入 PDF，都会通过唯一输入框到达 Agent，并被归档进 Trellis 知识图谱。
- 默认 web profile 除恢复对话外壳外保持不变；Trellis 专属行仅存在于 `examples/trellis/cordis.yml`。
