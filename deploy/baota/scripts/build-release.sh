#!/bin/bash
#
# 构建后端镜像、前端静态资源并原子发布
#

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
RUNTIME_ROOT="${RUNTIME_ROOT:-/www/server/opinion-monitor}"
SITE_ROOT="${SITE_ROOT:-/www/wwwroot/opinion-monitor}"
VERSION="${1:-$(date +%Y%m%d%H%M%S)}"
BACKEND_IMAGE="opinion-monitor/backend:${VERSION}"
RELEASE_DIR="$SITE_ROOT/releases/$VERSION"
CURRENT_LINK="$SITE_ROOT/current"
COMPOSE_ENV="$RUNTIME_ROOT/compose/.env"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RELEASE] $*" | tee -a "$RUNTIME_ROOT/logs/release.log"; }
fail() { log "ERROR: $*"; exit 1; }

check_requirements() {
  command -v docker >/dev/null 2>&1 || fail "Docker 未安装"
  command -v pnpm >/dev/null 2>&1 || fail "pnpm 未安装"
  [[ -f "$COMPOSE_ENV" ]] || fail "未找到运行配置: $COMPOSE_ENV"
  [[ -f "$PROJECT_ROOT/backend/Dockerfile" ]] || fail "未找到后端 Dockerfile"
}

build_backend() {
  log "构建后端镜像: $BACKEND_IMAGE"
  docker build -t "$BACKEND_IMAGE" "$PROJECT_ROOT/backend"
}

build_frontends() {
  log "构建管理端静态资源"
  (cd "$PROJECT_ROOT/frontend-admin" && pnpm run build)

  log "构建用户端静态资源"
  (cd "$PROJECT_ROOT/frontend-user" && pnpm run build)
}

publish_frontends() {
  log "发布前端静态资源: $RELEASE_DIR"
  mkdir -p "$RELEASE_DIR/admin" "$RELEASE_DIR/user"
  cp -a "$PROJECT_ROOT/frontend-admin/dist/." "$RELEASE_DIR/admin/"
  cp -a "$PROJECT_ROOT/frontend-user/dist/." "$RELEASE_DIR/user/"

  # 原子切换 current 指针，保留历史 release 用于回滚
  ln -sfn "$RELEASE_DIR" "$SITE_ROOT/current.next"
  mv -Tf "$SITE_ROOT/current.next" "$CURRENT_LINK"
  log "前端静态资源已原子发布"
}

update_compose_env() {
  local temp_env
  temp_env=$(mktemp)
  awk -v image="$BACKEND_IMAGE" -v version="$VERSION" '
    /^BACKEND_IMAGE=/ { print "BACKEND_IMAGE=" image; seen_image=1; next }
    /^APP_VERSION=/ { print "APP_VERSION=" version; seen_version=1; next }
    { print }
    END {
      if (!seen_image) print "BACKEND_IMAGE=" image
      if (!seen_version) print "APP_VERSION=" version
    }
  ' "$COMPOSE_ENV" > "$temp_env"
  chmod 600 "$temp_env"
  mv "$temp_env" "$COMPOSE_ENV"
  log "已更新运行时镜像配置"
}

write_release_metadata() {
  cat > "$RELEASE_DIR/release.json" <<EOF
{
  "version": "$VERSION",
  "backendImage": "$BACKEND_IMAGE",
  "createdAt": "$(date -Iseconds)",
  "source": "$PROJECT_ROOT"
}
EOF
}

main() {
  check_requirements
  mkdir -p "$RUNTIME_ROOT/logs" "$SITE_ROOT/releases"
  build_backend
  build_frontends
  publish_frontends
  update_compose_env
  write_release_metadata
  log "发布构建完成: version=$VERSION image=$BACKEND_IMAGE"
  echo "$VERSION"
}

main "$@"
