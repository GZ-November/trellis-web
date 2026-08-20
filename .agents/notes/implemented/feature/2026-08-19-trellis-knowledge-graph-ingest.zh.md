# Agent Note: Trellis 个人知识库、文本文档摄取与交互式关系图谱

Status: implemented

[English](2026-08-19-trellis-knowledge-graph-ingest.md) | 中文

## Problem

用户需要在 DeepSeek Harness 内拥有一个个人知识管理工作台，支持直接在对话输入框中拖入网页链接与文本文档，由 Agent 自动完成归档、分类与关系挖掘，并以带有真实来源、证据片段与置信度的交互式图谱形式进行浏览与学习。现有的工作台工具仅提供扁平的单表存储，缺乏文档间的关联索引、图谱投影能力以及专属的浏览器可视化界面。

## Decision

**来源溯源的知识持久化。** 在 Trellis 领域模型中扩展 `knowledge_documents` 表，基于内容摘要生成的唯一 ID 存储 `KnowledgeDocumentRecord`。每条记录均保留其来源凭据（`KnowledgeSource`：包含抓取元数据的 URL、文本文档名称/类型或粘贴文本）、标题、Agent 提炼的摘要、规范化标签，以及带有关系类型、边标签、证据原文和置信度的有向 `KnowledgeRelationRecord`。

**面向 Agent 的知识工具链。** 在 `ctx.tools` 上注册五个知识工具：`trellis_ingest` 用于幂等文档摄取（支持通过 `ctx.web.fetch` 自动抓取网页内容）、`trellis_search` 用于关键词和标签检索并返回带评分的摘要片段、`trellis_read` 用于获取完整正文与计算反向链接、`trellis_connect` 用于追加带证据的有向关联、`trellis_graph` 用于返回有界图谱快照。

**对话框文档摄取。** 扩展 `InputBar` 的拖拽与粘贴处理逻辑，在支持图片的基础上支持常见文本文档格式（`.md`、`.txt`、`.json`、`.csv`、`.xml`、`.yaml`、`.html`、`.org`）。拖入的文档被解析为结构化文档块填入输入框，并通过系统提示词引导 Agent 自动对新内容进行检索、归档、标签提取与关联建边。

**交互式图谱工具视图。** 创建 `@deepseek-ai/dsh-client-ui-trellis-graph`，为 `trellis_graph` 工具调用结果注册专属的 `tool.call.toolview` 渲染器。组件基于力导向图呈现文档节点与关系连线，支持自适应缩放、点击聚焦居中、节点检索过滤，并提供侧边栏面板查看文档摘要、来源详情、关联关系与证据依据。

**确定性测试与快照。** 为领域存储、工具执行与前端渲染编写了完备的单元测试，并在 `examples/trellis/tests/trellis.snapshot.ts` 中添加了基于真实 Loader 组合的无密钥快照测试。

## Alternatives considered

**引入外部桌面知识库或 AGPL 图谱框架。** 拒绝此方案以保持纯正的 MIT 协议、无需额外外部常驻进程，并与 Harness 现有的 SQLite 持久化无缝融合。

**仅使用非结构化正文双链（Wikilink）表示关联。** 拒绝此方案，因为 Agent 查询、有界邻域遍历以及带置信度的可视化图谱均依赖于显式且包含证据支撑的结构化关系数据。

## Consequences

Trellis 具备了完整的本地优先个人知识工作台能力。用户拖入文档或输入链接即可触发 Agent 自动整理与关系建链，既能通过对话让 Agent 检索调用，也能在交互式知识图谱中直观浏览学习。
