# Agent Note: 恢复 Trellis 全屏工作台外壳

Status: implemented

[English](2026-08-20-trellis-workbench-shell-restored.md) | 中文

## Problem

一次对话优先的实验为 Trellis profile 恢复了常规三栏对话外壳。用户的实际使用流程不需要对话，并且更喜欢最初的全屏 Trellis 工作台界面；独立的桌面打包层也不再需要。

## Decision

1. **恢复全屏工作台外壳。** 重新加入 `@deepseek-ai/dsh-client-ui-trellis-shell` 客户端插件，以优先级 `-1` 将全屏 `TrellisHome` 组件注册进内置 `root` 槽位。单槽位中低优先级者胜出，因此该外壳遮蔽常规对话布局，sessions/workspaces 服务继续在底层运行。
2. **外壳集成现有新功能。** 外壳保留收集栏、可搜索文档台账、可拖拽知识画布、文档详情、深度阅读模式与分析记录，并新增紧凑的伴学浏览器抽屉；浏览器中的剪藏动作会把页面内容放回外壳收集栏。
3. **保留对话槽位 Trellis 视图，但在本 profile 中禁用。** `ui-trellis-graph`、`ui-trellis-browser`、`ui-trellis-knowledge` 在默认 Web profile 中保持可用；独立外壳 profile 自身承载这些界面，因此将其禁用。
4. **删除桌面打包层。** 删除 `desktop/` 脚手架及其生成构建；`pnpm trellis:web` 仍是唯一运行入口。
5. **保留宿主侧收集行为。** `dsh-file-upload`、`dsh-read-url`、`dsh-deepread` 与 Trellis 工具继续挂载；二进制文件拖入通过 `/api/upload` 上传并由 `read_document` 归档；`tool-web` 保持启用 DeepSeek 原生搜索。

## Alternatives considered

- **通过值导入嵌入现有浏览器视图。** 拒绝：客户端 bundle purity 门禁禁止跨插件值导入；因此外壳改为自持一个紧凑浏览器面板。
- **删除外壳并让对话 UI 隐藏聊天区域。** 拒绝：这会把工作台耦合到共享三栏布局，重新引入原外壳所避免的耦合。

## Consequences

- `pnpm trellis:web` 打开最初的全屏 Trellis 工作台，并包含新浏览器抽屉与当前全部知识功能。
- 默认 Web profile 仍渲染常规对话外壳；只有 Trellis overlay 切换到独立工作台。
