# DPH任务看板插件 - 安装指南

> 快速入门请看 [README.md](./README.md) 的「安装」章节；本文件为详细版。

## 🚀 快速安装

### 前置条件
- DeepSeek Harness (DSH) 已安装
- Node.js 18+ 已安装
- DSH Web Profile 可用

### 安装步骤

1. **克隆或下载插件**
   ```bash
   git clone <仓库地址> dph-taskboard
   cd dph-taskboard
   ```

2. **一键安装**
   ```bash
   node scripts/deploy.mjs
   ```

3. **重启DSH**
   ```bash
   node scripts/restart-harness.sh
   # 或手动：/Users/<你的用户名>/.local/bin/dsh --profile web
   ```

4. **验证安装**
   - 在浏览器中打开 http://127.0.0.1:3080
   - 在侧边栏「工作区」搜索图标左侧查看是否有任务看板按钮

## 🔧 手动安装

如果自动安装失败，可以手动安装：

### 步骤1：构建插件
```bash
node scripts/build.mjs
```

### 步骤2：复制文件
```bash
# 创建目标目录
mkdir -p ~/.dsh/profiles/node_modules/@dph/taskboard

# 复制文件
cp package.json ~/.dsh/profiles/node_modules/@dph/taskboard/
cp -r lib ~/.dsh/profiles/node_modules/@dph/taskboard/
cp -r src ~/.dsh/profiles/node_modules/@dph/taskboard/
```

### 步骤3：注册插件
在 `~/.dsh/profiles/web/cordis.patch.yml` 中添加（注意 `name` 必须加引号，`@` 是 YAML 保留字符）：
```yaml
# DPH 任务看板客户端插件（@dph/taskboard）—— 由 scripts/deploy.mjs 维护
- insert:
    - id: taskboard
      name: "@dph/taskboard"
```

### 步骤4：重启DSH
```bash
/Users/<你的用户名>/.local/bin/dsh --profile web
```

## 🎯 验证安装

### 方法1：检查HTTP响应
```bash
curl -s "http://127.0.0.1:3080/plugins/@dph/taskboard/client.js" -o /dev/null -w "%{http_code}\n"
# 应该返回 200
```

### 方法2：检查DSH日志
启动DSH时查看控制台输出，应该有 `[dph-taskboard]` 相关日志。

### 方法3：检查浏览器控制台
在DSH Web界面中打开浏览器开发者工具（F12），查看Console是否有插件加载日志。

## 🐛 常见问题

### 问题1：插件按钮不显示
**解决方案**：
1. 刷新浏览器页面
2. 清除浏览器缓存
3. 检查DSH是否正确加载插件
4. 重新运行 `node scripts/deploy.mjs`

### 问题2：构建失败
**解决方案**：
1. 检查Node.js版本：`node --version`
2. 检查文件权限
3. 查看错误信息并修复

### 问题3：DSH启动失败
**解决方案**：
1. 检查DSH安装：`dsh --version`（或 `/Users/<你的用户名>/.local/bin/dsh --version`）
2. 检查端口是否被占用：`lsof -i :3080`
3. 查看DSH日志：`~/.dsh/logs/dsh-web.log`

## 📝 卸载插件

### 步骤1：移除挂载点
```bash
node scripts/mount-ui-workspace.mjs --revert
```

### 步骤2：删除插件文件
```bash
rm -rf ~/.dsh/profiles/node_modules/@dph/taskboard
```

### 步骤3：移除注册行
从 `~/.dsh/profiles/web/cordis.patch.yml` 中删除 taskboard 相关行。

### 步骤4：重启DSH
```bash
/Users/<你的用户名>/.local/bin/dsh --profile web
```

## 🎉 安装完成

安装完成后，您可以在DSH Web界面的侧边栏「工作区」搜索图标左侧看到任务看板按钮。点击按钮即可打开任务看板，开始管理您的任务！

**享受使用DPH任务看板插件的乐趣！🚀**