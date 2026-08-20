# DPH 任务看板（@dph/taskboard）— DeepSeek Harness 客户端插件

在 Harness 侧边栏「工作区」**搜索图标左侧**提供任务看板入口（与搜索按钮同款样式）。

**完全会话化**：看板上的每一张卡片就是一个真实会话（harness session），卡片 = 会话，
拖拽归类 = 给会话打状态标记，新建卡片 = 真正新建一个会话。

![任务看板截图（占位，发布前请替换为真实界面截图）](docs/screenshot.png)

## 功能

- **侧边栏入口**：工作区搜索图标左侧的看板按钮（wide / 窄栏 rail 两种形态）
- **四列状态看板**：待办 / 进行中 / 评审中 / 已完成，拖拽归类，彩色状态标识
- **会话总览列**：未归类会话集中显示，点击卡片进入会话
- **完全会话化**：
  - 卡片 = 会话；看板显示与侧边栏一致（隐藏子代理 / 归档 / 空白会话）
  - **新建会话**：命名 + 选模型 + 推理强度 + 开始消息 + 选择分组（跟随当前 / 已有分组 / 新建分组）
  - 删除会话 → 进回收站（可恢复，恢复后回到原列）
  - 运行状态点：正在处理的会话卡片右上角有呼吸闪烁的「处理中」标记
- **备注**：每个会话可附加描述 / 优先级（低中高紧急）/ 标签，存浏览器 localStorage
- **搜索**：按会话标题 / 备注 / 标签过滤
- **导出 / 导入**：打勾自由选择会话，导出 JSON 备份（含归类、备注、新会话标记），导入前有覆盖确认
- **Agent 可读快照**：宿主侧把看板状态落盘 `~/.dsh/storages/taskboard.json`，
  模型（Agent）可用文件工具读取分析

数据保存在浏览器 `localStorage`（key: `dph.taskboard.v1`）。

## 插件形态

插件不是安装包，而是一个**标准文件夹** + harness 配置里的一行注册：

```
dph-taskboard/
├── package.json                  # @dph/taskboard；dsh.client 声明（platform: web + 服务注入）
├── lib/index.js                  # 宿主侧：快照落盘 + 会话恢复（unarchive）
├── lib/client.js                 # 浏览器端代码（构建产物，由 src/client/index.js 生成）
├── src/client/index.js           # 客户端源码（改代码改这里）
├── scripts/
│   ├── build.mjs                 # src/client → lib/client.js
│   ├── deploy.mjs                # 一键安装：构建 + 复制到 harness 模块区 + 写注册行
│   ├── mount-ui-workspace.mjs    # ui-workspace 挂载点补丁（幂等；--revert 回滚）
│   └── restart-harness.sh        # 一键重启 harness（按端口精确停止/启动/验证）
├── smoke-test.mjs                # 冒烟测试（自动先构建）
├── INSTALL.md                    # 详细安装指南
└── README.md                     # 本文件
```

安装后出现在 harness 模块区：`~/.dsh/profiles/node_modules/@dph/taskboard/`

## 安装

前置条件：本机装有 DeepSeek Harness（`dsh web` 可用）、Node.js 18+。

```bash
# 1) 获取插件
git clone <你的仓库地址> dph-taskboard
cd dph-taskboard

# 2) 一键安装（自动：构建 → 复制到 harness 模块区 → 写入注册行）
node scripts/deploy.mjs

# 3) 重启 harness 生效（重启会中断当前会话；看板数据在浏览器 localStorage 不丢）
node scripts/restart-harness.sh
# 或手动：dsh --profile web

# 4) 浏览器打开 harness，刷新页面
#    侧边栏工作区搜索图标左侧出现任务看板按钮
```

> 若 `dsh` 命令不在 PATH：用完整路径 `/Users/<你的用户名>/.local/bin/dsh --profile web`，
> 或先 `export PATH="$HOME/.local/bin:$PATH"`。

> **注意**：若 harness 从 npx 缓存运行（启动命令含 `~/.npm/_npx/...`），
> ui-workspace 挂载补丁需要打到对应副本：
> `node scripts/mount-ui-workspace.mjs --target=<npx副本的 dsh-client-ui-workspace/lib/client.js 路径>`

### 验证安装

```bash
curl -s "http://127.0.0.1:3080/plugins/@dph/taskboard/client.js" -o /dev/null -w "%{http_code}\n"   # 应为 200
# 或看 harness 启动日志 / 浏览器 F12 Console 是否有 [dph-taskboard] 输出
```

## 开发 / 迭代

```bash
node scripts/build.mjs                 # 改完 src/client/index.js 后重新构建
node scripts/deploy.mjs                # 重新部署（客户端 HMR 热载，刷新页面即可）
node smoke-test.mjs                    # 冒烟测试
```

## 卸载

```bash
node scripts/mount-ui-workspace.mjs --revert   # 移除 ui-workspace 挂载点
rm -rf ~/.dsh/profiles/node_modules/@dph/taskboard   # 删除插件文件
# 从 ~/.dsh/profiles/web/cordis.patch.yml 删除 taskboard 注册段
# 重启 harness
```

## 许可

MIT License
