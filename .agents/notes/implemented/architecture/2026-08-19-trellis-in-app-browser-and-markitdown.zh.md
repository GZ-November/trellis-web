# Agent Note: Trellis 内置浏览器、MarkItDown 转换器与知识归档

Status: implemented

[English](2026-08-19-trellis-in-app-browser-and-markitdown.md) | 中文

## Problem

在学习在线课程、阅读文档或进行网络研究时，用户需要在学习环境中直接交互式浏览网页，将杂乱的 HTML 网页转为干净结构化的 Markdown，并一键归档到关系型知识图谱中。

此前，网页阅读需要在外部应用之间切换并手动复制文本粘贴到对话框中；网络内容提取缺乏结构化的 Markdown 转换流水线来保留文档层级、表格、引用块和代码块，同时剔除冗余的导航干扰。

## Decision

1. **Microsoft MarkItDown 架构集成**：在 `@trellis/trellis` (`markitdown.ts`) 中基于 Microsoft MarkItDown 原理实现纯 TypeScript 的 Markdown 转换引擎，过滤 script、style 和 nav 等噪声元素，将 HTML 表格转为标准 GFM 表格，保留代码块缩进与语法标签，并提取网页标题、链接与导言摘要。
2. **内置 Chromium 浏览器与剪藏客户端插件**：创建 `@deepseek-ai/dsh-client-ui-trellis-browser` 并注册到会话视图槽位（`conversation.view`，id: `trellis_browser`），提供导航控制栏、一键「归档到知识库」操作、用于复用 Google 账号与学校登录态的外部 Chrome 跳转桥接、MarkItDown 阅读模式以及在线课程书签抽屉。
3. **知识库摄取流水线整合**：将 `convertToMarkdown` 直接集成到 `TrellisKnowledge.ingest` 中，使所有摄取的网页、文档和文件在存入 SQLite 领域表前均完成结构化 Markdown 标准化。

## Alternatives considered

- **Puppeteer/Playwright 重型无头浏览器方案**：未采纳，因为在后台启动完整无头 Chrome 进程会引入繁重二进制依赖、拖慢启动速度并带来跨平台环境限制；而 iframe 嵌入配合轻量级 MarkItDown 转换能够达到轻量快速的体验。
- **外部 Obsidian 联动方案**：未采纳，因为用户期望在 Trellis 产品内部直接获得内置的力导向交互知识图谱与无缝剪藏体验，而非维护外部独立的 Obsidian 库。

## Consequences

- Trellis 中的网页与文档摄取能够生成干净、格式规整的 Markdown，免除手动复制粘贴。
- 用户可以直接在会话界面中浏览学习资料与在线课程，并一键将其沉淀关联至知识图谱。
- 受限或需要登录的网页可一键在系统 Google Chrome 中打开，同时保留剪藏功能。
