#!/bin/bash
#
# 首次初始化数据库 Schema、管理员账号并启动应用
#

set -euo pipefail

RUNTIME_ROOT="${RUNTIME_ROOT:-/www/server/opinion-monitor}"
COMPOSE_DIR="$RUNTIME_ROOT/compose"
ENV_FILE="$COMPOSE_DIR/.env"
LOG_DIR="$RUNTIME_ROOT/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BOOTSTRAP] $*" | tee -a "$LOG_DIR/bootstrap.log"; }
fail() { log "ERROR: $*"; exit 1; }

require_file() {
  [[ -f "$1" ]] || fail "缺少文件: $1"
}

wait_for_backend() {
  local attempts=30
  local i=1
  while [[ $i -le $attempts ]]; do
    if docker compose -f "$COMPOSE_DIR/docker-compose.yml" ps backend --format json 2>/dev/null | grep -q 'running'; then
      log "后端容器已运行"
      return 0
    fi
    log "等待后端启动 ($i/$attempts)..."
    sleep 2
    ((i++))
  done
  fail "后端启动超时"
}

initialize_schema() {
  log "执行首次数据库 Schema 初始化与服务启动"
  local tmp_env
  tmp_env=$(mktemp)
  cp "$ENV_FILE" "$tmp_env"

  # 首次启动时开启 TypeORM synchronize，后端将根据 INIT_ADMIN_PASSWORD 自动创建管理员
  printf '\nDB_SYNCHRONIZE=true\n' >> "$tmp_env"

  docker compose --env-file "$tmp_env" -f "$COMPOSE_DIR/docker-compose.yml" up -d mysql redis backend
  rm -f "$tmp_env"
  log "数据库 Schema 已同步，后端将根据 INIT_ADMIN_PASSWORD 创建初始管理员"
}

main() {
  mkdir -p "$LOG_DIR"
  require_file "$ENV_FILE"
  require_file "$COMPOSE_DIR/docker-compose.yml"

  initialize_schema
  wait_for_backend
  log "首次初始化完成，管理员账户已创建（用户名: admin，密码见 $ENV_FILE）"
}

main "$@"
