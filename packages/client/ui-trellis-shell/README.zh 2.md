# @deepseek-ai/dsh-client-ui-trellis-shell

[English](README.md) | 中文

Trellis 独立外壳：面向 DeepSeek Harness Web 客户端的极简全屏知识库界面。它遮蔽常规的聊天/工作区布局，提供直接的信息收集、通过 Trellis Agent 工具的自动整理，以及聚焦的文档分析面板。

## 功能特性

- 全屏根界面，不显示侧边栏、工作区列表或对话外壳。
- 收集栏支持输入链接、粘贴文本或拖入文本文档。
- 收集提示通过隐藏的 Trellis 会话执行；Agent 完成后知识列表自动刷新。
- 文档列表支持按标题、摘要和标签搜索。
- 详情抽屉展示已存文档内容与来源信息。
- 分析面板向 Agent 发送聚焦问题，并渲染对应的分析过程记录。
- 知识图谱画布将文档呈现为可拖拽卡片、关系呈现为连线，支持平移、缩放与卡片位置持久化。

## 已集成插件

Trellis profile 在底层启用了多个 DSH 插件：

- `dsh-read-url` — 更干净的网页读取、编码识别、批量读取与 SPA 渲染。
- `dsh-deepread` — 五种深度阅读模式、知识地图、PDF 提取与思维导图导出。
- `dsh-file-upload` — 内置 MarkItDown 文档转换与 `read_document` 工具，支持 PDF/DOCX/XLSX 等。
- `dsh-memory-palace` — 用户级/工作区级 Markdown 记忆，自动注入 Agent 回合。
- `@0xsline/dsh-spotlight` — 键盘优先命令面板。
- `@dph/taskboard` — 会话任务看板，通过 Trellis 顶部的 `data-dph-taskboard-mount` 锚点挂载按钮。
- `dsh-zotero` — Zotero 文献库搜索、证据提取与引用生成。
- `dsh-plugin-academic-writing` — 论文大纲、摘要、引文、措辞质检与投稿前检查工具。

## 模型体验

本包是浏览器端展示插件，本身不注册面向模型的工具或提示片段。收集与分析提示会出现在会话日志中，但不属于本包的模型面契约。

#### KV Cache 影响

无。

## 已知限制与后续规划

- 外壳仍在底层运行标准 Web 客户端；它隐藏了聊天/工作区 UI，而非移除这些宿主服务。
- 拖入收集栏的文本文件会在浏览器中直接读取；PDF/DOCX/XLSX 等文件会上传到 `dsh-file-upload`，由 Agent 使用 `read_document` 读取后再归档进 Trellis。
- 知识画布当前映射文档与关系；分析分支尚未作为独立画布节点展示。
