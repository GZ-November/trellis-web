#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# DPH harness 一键重启脚本
# 用法：
#   bash scripts/restart-harness.sh          # 默认端口 3080
#   PORT=3456 bash scripts/restart-harness.sh  # 换端口
# 功能：停掉旧实例 → 启动新实例 → 等待就绪 → 验证插件 → 输出日志位置
# 安全：只按端口精确停止（不会误杀其他进程）；日志写到 ~/.dsh/logs/ 方便排查
# ═══════════════════════════════════════════════════════════════════════════
set -eo pipefail

echo "🔧 DPH harness 一键重启脚本启动"

PORT="${PORT:-3080}"
[ -z "$PORT" ] && PORT=3080
# 优先用全局 dsh（~/.local/bin）；若你的环境不同可用 DSH_BIN 覆盖
DSH_BIN="${DSH_BIN:-$HOME/.local/bin/dsh}"
PROFILE="${PROFILE:-web}"
LOG_DIR="$HOME/.dsh/logs"
LOG_FILE="$LOG_DIR/dsh-web.log"

echo "──────────────────────────────────────────────"
echo " DPH harness 一键重启 (v2)"
echo "   脚本: $(basename "$0") / bash $(bash --version | head -1 | grep -o "version [0-9.]*")"
echo "   端口:   $PORT"
echo "   二进制: $DSH_BIN"
echo "──────────────────────────────────────────────"

# ── 1/4 停止当前实例（按端口精确匹配）──────────────────────────────────
echo "==> [1/4] 停止当前 harness（端口 $PORT）"
PID=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PID" ]; then
  echo "    发现进程 PID $PID，发送停止信号..."
  kill "$PID" 2>/dev/null || true
  # 最多等 10 秒优雅退出
  for _ in $(seq 1 20); do
    if ! kill -0 "$PID" 2>/dev/null; then break; fi
    sleep 0.5
  done
  if kill -0 "$PID" 2>/dev/null; then
    echo "    未在 10 秒内退出，强制终止..."
    kill -9 "$PID" 2>/dev/null || true
    sleep 1
  fi
  echo "    已停止。"
else
  echo "    端口 $PORT 没有进程在跑（无需停止）。"
fi

# ── 2/4 启动新实例 ───────────────────────────────────────────────────────
echo "==> [2/4] 启动 harness（$DSH_BIN --profile $PROFILE）"
if [ ! -x "$DSH_BIN" ]; then
  echo "❌ 找不到 dsh 二进制：$DSH_BIN"
  echo "   请用 DSH_BIN 指定，例如："
  echo "   DSH_BIN=$(command -v dsh 2>/dev/null || echo "<dsh 绝对路径>") bash scripts/restart-harness.sh"
  exit 1
fi
mkdir -p "$LOG_DIR"
nohup "$DSH_BIN" --profile "$PROFILE" > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "    新实例 PID $NEW_PID，日志: $LOG_FILE"

# ── 3/4 等待端口就绪 ─────────────────────────────────────────────────────
echo "==> [3/4] 等待服务就绪（最多 30 秒）..."
READY=0
for i in $(seq 1 60); do
  if ! kill -0 "$NEW_PID" 2>/dev/null; then
    echo "❌ 进程提前退出！最近日志："
    tail -30 "$LOG_FILE" || true
    exit 1
  fi
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
    READY=1
    echo "    服务已就绪（约 ${i}x0.5 秒）"
    break
  fi
  sleep 0.5
done
if [ "$READY" != "1" ]; then
  echo "❌ 等待超时。最近日志："
  tail -30 "$LOG_FILE" || true
  exit 1
fi

# ── 4/4 验证插件 ─────────────────────────────────────────────────────────
echo "==> [4/4] 验证插件加载"
PLUGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/plugins/@dph/taskboard/client.js" 2>/dev/null || echo '?')
echo "    看板插件 client.js → HTTP $PLUGIN_CODE"
if [ "$PLUGIN_CODE" = "200" ]; then
  echo ""
  echo "✅ 重启完成！打开 http://127.0.0.1:$PORT 并刷新页面。"
  echo "   侧边栏工作区搜索图标左侧应有任务看板按钮。"
  echo "   日志: $LOG_FILE（有问题时查看这里）"
else
  echo "⚠️  服务已启动，但看板插件未正常服务（HTTP $PLUGIN_CODE）。"
  echo "   请查看日志: $LOG_FILE"
  exit 1
fi
