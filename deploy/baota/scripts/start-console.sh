#!/bin/bash
#
# 启动部署控制台
#

set -euo pipefail

RUNTIME_ROOT="${RUNTIME_ROOT:-/www/server/opinion-monitor}"
CONSOLE_DIR="$RUNTIME_ROOT/console"
LOG_FILE="$RUNTIME_ROOT/logs/console.log"

cd "$CONSOLE_DIR"

# 检查 Node.js
if ! command -v node &>/dev/null; then
  echo "错误: 未安装 Node.js，请先安装 Node.js 20+"
  exit 1
fi

# 安装依赖
if [[ ! -d node_modules ]]; then
  echo "安装控制台依赖..."
  npm install
fi

# 启动服务
echo "启动部署控制台..."
nohup node server.mjs >> "$LOG_FILE" 2>&1 &
echo $! > "$RUNTIME_ROOT/.console_pid"

echo "部署控制台已启动，PID: $(cat "$RUNTIME_ROOT/.console_pid")"
echo "访问地址: http://127.0.0.1:8888"
echo "日志文件: $LOG_FILE"
