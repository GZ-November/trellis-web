# Trellis

> 一个基于 DeepSeek Harness 构建的独立学术 + 职业工作台。

Trellis 是一个本地优先的个人工作台，用来收集岗位、联系人、课程、学分、比赛和知识笔记，并让 Agent 帮你归档、分析、规划和搜索。所有数据默认保存在 Trellis 自己的目录里，不会影响你的 DeepSeek Harness 开发环境。

![Trellis Web UI](assets/screenshots/trellis-home.png)

## 功能

- **本地优先**：SQLite 存储，数据在 `.trellis-data/`，可随时导出。
- **独立运行环境**：Trellis 使用自己的 `.trellis-home/`，与开发用的 `~/.dsh` 完全隔离。
- **网页自动归档**：粘贴网址或内容，`trellis_archive` 自动整理成笔记并登记来源。
- **职业追踪**：岗位 JD、联系人、申请状态、比赛/奖学金。
- **学业规划**：课程、毕业要求、学期计划、毕业时间推算。
- **技能差距分析**：把目标技能和你的课程/笔记对比，找出缺口。
- **知识库导出**：一键导出 JSON + Markdown，方便外部查看和备份。
- **完全插件化**：基于 DeepSeek Harness / Cordis，所有能力都是插件。

## 快速开始

### 环境要求

- Node.js `^22.19 || >=24`
- pnpm
- DeepSeek API Key（仅 Agent 对话时需要；构建和 UI 不需要）

### 安装与构建

```bash
git clone https://github.com/GZ-November/trellis-web.git
cd trellis-web
pnpm install
pnpm run build
```

### 启动 Trellis Web

```bash
DSH_HOME=/absolute/path/to/trellis-web/.trellis-home \
pnpm dsh --profile trellis --patch examples/trellis/cordis.yml
```

打开 http://127.0.0.1:3081。

> 在仓库根目录运行时，可以直接用：
>
> ```bash
> DSH_HOME=$PWD/.trellis-home pnpm dsh --profile trellis --patch examples/trellis/cordis.yml
> ```

### 配置模型

打开 Web UI 后进入 **设置 → 模型**，填入 DeepSeek API Key 即可开始对话。Trellis 的所有内置工具都只依赖 DeepSeek API，不需要额外服务。

## 数据隔离

| 目录 | 用途 |
|---|---|
| `.trellis-home/` | Trellis 自己的 DSH 运行配置（profile） |
| `.trellis-data/` | Trellis 的 SQLite 数据库和导出文件 |
| `~/.dsh/` | 你的 DeepSeek Harness 开发环境（Trellis 不读写） |

把整个 `trellis-web` 目录迁移到其他机器时，`.trellis-home/` 和 `.trellis-data/` 会跟着一起走。

## Agent 工具

| 工具 | 说明 |
|---|---|
| `trellis_archive` | 归档网页/内容为笔记，并登记来源 |
| `trellis_job_import` | 导入岗位 JD |
| `trellis_job_list` | 查询岗位 |
| `trellis_contact_import` | 保存 LinkedIn/联系人 |
| `trellis_application_upsert` | 跟踪申请状态 |
| `trellis_note_create` | 创建知识笔记 |
| `trellis_link_note` | 给笔记添加双向链接 |
| `trellis_course_upsert` | 录入课程 |
| `trellis_degree_requirement_upsert` | 录入毕业要求 |
| `trellis_academic_plan_upsert` | 录入学期选课计划 |
| `trellis_source_register` | 登记招聘页/课程页/比赛页来源 |
| `trellis_competition_import` | 录入比赛/奖学金 |
| `trellis_search` | 跨全部表搜索 |
| `trellis_summary` | 汇总知识库状态 |
| `trellis_export` | 导出知识库为 JSON + Markdown |
| `trellis_skill_gap` | 技能差距分析 |
| `trellis_graduation_forecast` | 毕业时间/学分推算 |
| `trellis_pipeline` | 按状态查看申请管道 |
| `trellis_deadlines` | 查看岗位和比赛截止日期 |
| `trellis_outreach_draft` | 生成联系人约谈草稿 |
| `trellis_course_recommend` | 根据目标技能推荐课程 |
| `trellis_auto_file` | 自动识别并归档原始内容到对应表 |

## 项目结构

```text
trellis-web/
├── .trellis-home/              # Trellis 独立 DSH 运行环境
├── .trellis-data/              # 本地数据（不入库）
├── examples/trellis/           # Trellis 启动 overlay
├── packages/trellis/trellis/   # Trellis 插件（存储 + 工具）
├── apps/web/                   # Web 前端
└── assets/screenshots/         # README 截图
```

## 技术栈

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — Agent 运行时
- Cordis — 插件化框架
- SQLite — 本地存储
- React / Vite — Web UI

## 制作思路

Trellis 的设计围绕几个核心想法：

1. **它是一个独立产品，而不是 DeepSeek Harness 的简单魔改。** Trellis 复用 DeepSeek Harness 作为运行时和插件系统，但保留自己的身份、UI、数据和配置。

2. **数据和开发环境必须分离。** Trellis 把运行配置放在 `.trellis-home/`，用户数据放在 `.trellis-data/`，完全不碰 `~/.dsh`。这样既安全，又方便整体迁移。

3. **一切皆插件。** 延续 DeepSeek Harness 的理念，Trellis 的每个功能都是一个 Cordis 插件，核心可以持续跟随上游升级，功能可以随时增删。

4. **让 Agent 做重复劳动。** 用户只需要粘贴原始信息，Agent 负责把链接、JD、联系人、课程计划结构化进本地知识库。

5. **只依赖 DeepSeek API。** Gemini、Codex、浏览器自动化都是可选增强；核心工作流只需要一个 DeepSeek API Key。

6. **本地优先、可迁移。** 所有知识存在本地 SQLite，可导出 JSON / Markdown。把 Trellis 目录搬到另一台机器，数据跟着走。

7. **从真实需求逐步长出来。** Trellis 从一个简单存储插件开始，逐步长成工作台：归档 → 职业追踪 → 学业规划 → 技能差距 → 毕业预测 → 自定义 UI。

## Roadmap

- 接入 `web_fetch` / 浏览器 MCP 做网页抓取
- LinkedIn 手动导出或浏览器自动化采集
- HUSD 课程目录爬虫
- 交互式 Dashboard 和知识预览 UI
- 定时岗位/比赛监控

## License

[MIT](LICENSE)

Trellis 是基于 DeepSeek Harness 的独立发行版，DeepSeek Harness 同样使用 MIT License。
