# @trellis/trellis

[English](README.md) | 中文

Trellis 是构建在 DeepSeek Harness 上的个人学术、职业与知识工作台。它提供本地优先的 SQLite 持久化、知识文档摄取、关系图谱管理和面向 Agent 的工具链。

## 功能特性

- 通过 DSH `storageDomain` 提供本地优先的 SQLite 存储。
- 摄取并归档网页、文本文档、笔记和粘贴内容，保留持久的来源凭据元数据。
- 带有置信度评分和反向链接的有向、含证据知识关系。
- 面向 Agent 与 UI 视图的有界图谱投影与基于关键词的知识检索。
- 导入并追踪职位、联系人、申请、课程、毕业要求、学期规划、外部来源和竞赛。

## 工具列表

- `trellis_ingest` — 摄取 URL 或文档内容，附带摘要、标签与初始关系。
- `trellis_search` — 按文本查询检索知识文档，返回摘要片段与排序分值。
- `trellis_read` — 获取完整文档内容，以及入向反向链接与出向关系。
- `trellis_connect` — 在两个现有文档之间添加有向且带证据的关系。
- `trellis_graph` — 返回知识图谱及其邻居的有界投影。
- `trellis_archive` — 传统网页与笔记归档工具。
- `trellis_job_import` / `trellis_job_list` — 导入并列出追踪的职位。
- `trellis_contact_import` — 记录专业联系人与跟进阶段。
- `trellis_application_upsert` — 创建或更新职位申请状态。
- `trellis_note_create` — 创建非结构化个人笔记。
- `trellis_course_upsert` — 追踪课程学分、成绩与先修要求。
- `trellis_degree_requirement_upsert` — 记录毕业学分要求分类。
- `trellis_academic_plan_upsert` — 规划学期安排与目标 GPA。
- `trellis_source_register` — 注册外部信息源以备定期检查。
- `trellis_competition_import` — 追踪竞赛、黑客松与奖学金截止时间。
- `trellis_summary` — 汇总所有工作台领域的状态。
- `trellis_link_note` — 将笔记关联到工作台条目。
- `trellis_export` — 将工作台记录导出为 Markdown 或 JSON。
- `trellis_skill_gap` — 对比职位技能要求与已修课程。
- `trellis_graduation_forecast` — 对照毕业要求核对学分进度。

## 模型体验

### Trellis 工具与归档

#### 模型看到的内容

插件向 Agent 运行时注册 `trellis_ingest`、`trellis_search`、`trellis_read`、`trellis_connect`、`trellis_graph` 以及传统工作台工具定义。被调用时，每个工具均针对本地 SQLite 存储执行，并返回匹配 `KnowledgeDocumentRecord`、`TrellisSearchHit`、`TrellisDocumentRead` 或 `TrellisGraphSnapshot` 的结构化 JSON 响应。

#### Token 影响

工具定义在激活期间占用工具目录上下文空间。执行工具会将 JSON 参数及结构化返回载荷计入对话上下文 Token。

#### KV Cache 影响

无影响：Trellis 记录通过 `storageDomain` 保存在 SQLite 中，不修改已发送请求的前缀 Token。

## 已知限制与后续规划

- PDF 与 DOCX 二进制解析委托给上游工具；摄取路径直接处理文本格式。
- 远程 URL 抓取使用 `ctx.web.fetch`，不针对富 JavaScript 单页应用启动无头浏览器渲染。
