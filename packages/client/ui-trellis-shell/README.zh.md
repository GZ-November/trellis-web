# @deepseek-ai/dsh-client-ui-trellis-shell

[English](README.md) | 中文

Trellis 全屏知识工作台外壳，用于 DeepSeek Harness Web 客户端。它注册一个无对话的全屏界面：链接与文档收集栏、可搜索文档台账、可拖拽知识画布、文档详情、深度阅读动作、分析记录，以及应用内伴学浏览器抽屉。

## 功能

- 在现有 sessions/workspaces 服务之上提供无对话的全屏工作台 UI。
- 收集栏支持 URL、粘贴文本、文本文档，以及通过 `dsh-file-upload` 上传的 PDF/DOCX/XLSX 等二进制文档。
- 由 `/api/trellis/knowledge` 驱动的知识台账与可搜索文档列表。
- 可拖拽、平移、缩放的知识画布，并持久化卡片位置。
- 文档详情面板提供来源凭据、深度阅读模式与有依据的分析。
- 伴学浏览器抽屉支持一键把网页剪藏回收集栏。

## 模型体验

本包是浏览器侧 UI 外壳，不直接注册面向模型的能力。收集与分析提示通过现有 conversation 服务路由，由 Trellis 工具执行归档与检索。

#### KV Cache 影响

无。

## 已知限制与后续工作

- 外壳有意隐藏常规对话栏；如需完整对话界面，请切换到默认 Web profile。
