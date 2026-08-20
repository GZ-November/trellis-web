# @deepseek-ai/dsh-client-ui-trellis-knowledge

[English](README.md) | 中文

Trellis 透明知识库中心视图：实时文档台账、概念提取关系网、依据原文溯源与全景 Obsidian 力导向图谱。

## 功能特性

- 实时知识文档台账，完整展示所有已归档文档、MarkItDown 提炼大纲、摘要与标签。
- 零黑盒概念关联与证据网络，清晰呈现依据原文引述及置信度百分比。
- 交互式 Obsidian 全景力导向图谱画布，支持分类色彩映射与缩放漫游。
- 抽屉式全文阅读器，支持 MarkItDown 原文大纲阅读与一键「让 Agent 深度分析」。

## 模型体验

无，本包为浏览器端 UI 视图插件，不注册任何面向模型的表面。

#### KV Cache 影响

无。

## 已知限制与后续规划

- 图谱渲染依赖 HTML5 Canvas。
- 文档预览呈现文本与 Markdown；二进制附件展示元数据与来源引用。
