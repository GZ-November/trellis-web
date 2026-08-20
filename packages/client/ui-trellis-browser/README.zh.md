# @deepseek-ai/dsh-client-ui-trellis-browser

[English](README.md) | 中文

DeepSeek Harness Web 客户端中用于 Trellis 的内置 Chromium 网页浏览器、在线课程工作台与 MarkItDown 剪藏视图。

## 功能特性

- 内置 Chromium 网页浏览器，支持实时浏览、历史后退/前进、刷新与地址栏输入。
- 一键「归档到知识库（Clip to Trellis）」操作，触发 MarkItDown 结构化提取并交由 Agent 建立知识图谱关联。
- 「在系统 Chrome 中打开」跳转按钮，便于利用 Google 账号及大学平台已有登录态。
- MarkItDown 阅读模式切换，提供干净结构化的 Markdown 大纲排版，免除杂乱干扰。
- 在线课程与学习资源书签抽屉，持久化管理常用学习与研究站点。

## 模型体验

无，本包为浏览器端 UI 视图插件，不注册任何面向模型的表面。

#### KV Cache 影响

无。

## 已知限制与后续规划

- 具有严格 `X-Frame-Options: SAMEORIGIN` 或 CSP 限制的页面可通过阅读模式浏览或直接在外部 Chrome 中打开。
