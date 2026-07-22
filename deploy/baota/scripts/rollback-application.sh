#!/bin/bash
#
# 应用回滚脚本（前端 + 后端镜像）
#

set -euo pipefail

RUNTIME_ROOT="${RUNTIME_ROOT:-/www/server/opinion-monitor}"
SITE_ROOT="${SITE_ROOT:-/www/wwwroot/opinion-monitor}"
COMPOSE_DIR="$RUNTIME_ROOT/compose"
ENV_FILE="$COMPOSE_DIR/.env"
TARGET_VERSION="${1:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ROLLBACK] $*" | tee -a "$RUNTIME_ROOT/logs/rollback.log"; }
fail() { log "ERROR: $*"; exit 1; }

list_versions() {
  log "可用版本列表:"
  ls -1t "$SITE_ROOT/releases/" 2>/dev/null || echo "无可用历史版本"
}

rollback_frontend() {
  local release_dir="$SITE_ROOT/releases/$TARGET_VERSION"
  [[ -d "$release_dir" ]] || fail "前端版本不存在: $TARGET_VERSION"

  log "回滚前端到版本: $TARGET_VERSION"
  ln -sfn "$release_dir" "$SITE_ROOT/current.next"
  mv -Tf "$SITE_ROOT/current.next" "$SITE_ROOT/current"
  log "前端已回滚"
}

rollback_backend() {
  local release_meta="$SITE_ROOT/releases/$TARGET_VERSION/release.json"
  [[ -f "$release_meta" ]] || fail "未找到版本元数据: $release_meta"

  local backend_image
  backend_image=$(jq -r '.backendImage' "$release_meta")
  [[ -n "$backend_image" && "$backend_image" != "null" ]] || fail "版本元数据中未找到后端镜像"

  log "回滚后端镜像: $backend_image"
  local temp_env
  temp_env=$(mktemp)
  awk -v image="$backend_image" -v version="$TARGET_VERSION" '
    /^BACKEND_IMAGE=/ { print "BACKEND_IMAGE=" image; seen_image=1; next }
    /^APP_VERSION=/ { print "APP_VERSION=" version; seen_version=1; next }
    { print }
    END {
      if (!seen_image) print "BACKEND_IMAGE=" image
      if (!seen_version) print "APP_VERSION=" version
    }
  ' "$ENV_FILE" > "$temp_env"
  chmod 600 "$temp_env"
  mv "$temp_env" "$ENV_FILE"
  log "后端镜像配置已回滚"
}

restart_backend() {
  log "重启后端服务以应用回滚"
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" up -d backend
}

main() {
  mkdir -p "$RUNTIME_ROOT/logs"

  if [[ -z "$TARGET_VERSION" ]]; then
    list_versions
    fail "用法: rollback-application.sh <版本号>"
  fi

  rollback_frontend
  rollback_backend
  restart_backend
  log "回滚完成: $TARGET_VERSION"
}

main "$@"
