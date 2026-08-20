# dsh-plugin-academic-writing

面向 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) agent 的**学术写作工具包**。模型负责行文，插件提供结构、格式与确定性检查。

## 安装

```bash
dsh plugin --profile <profile> add dsh-plugin-academic-writing
```

重启 DSH 后，`academic_writing` 工具全局注册。

## 工具

| 动作 | 用途 |
| --- | --- |
| `outline` | 论文大纲骨架（研究 / 综述 / 开题 / 议论文），可限章节数 |
| `title` | 按风格模板生成标题候选（描述式、疑问式、断言式、冒号式） |
| `abstract` | 结构化摘要骨架 —— 背景 / 方法 / 结果 / 结论 |
| `citation` | 参考文献条目格式化为 **GB/T 7714**、**APA 7** 或 **MLA 9** |
| `check` | 段落措辞质检（被动语态、第一人称、模糊限定、句长） |
| `checklist` | 投稿前清单（伦理、利益冲突、数据、基金、排版） |

## 配置

均为可选项，写在组合行的 `config` 里：

| 键 | 默认值 | 含义 |
| --- | --- | --- |
| `personaSection` | `true` | 是否注册学术写作提示词段 |
| `sectionOrder` | `6` | 提示词段顺序（persona 为 0，升序） |

## 设计

纯逻辑（`lib/academic.js`）零 DSH/Cordis 依赖、可独立单测；`lib/index.js` 是薄 Cordis 壳，只负责注册工具与提示词段。无文件系统访问，全部确定性、无副作用。

## License

MIT
