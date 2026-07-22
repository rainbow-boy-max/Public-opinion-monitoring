#!/bin/bash
#
# 数据库与运行配置备份脚本
#

set -euo pipefail

RUNTIME_ROOT="${RUNTIME_ROOT:-/www/server/opinion-monitor}"
COMPOSE_DIR="$RUNTIME_ROOT/compose"
ENV_FILE="$COMPOSE_DIR/.env"
BACKUP_ROOT="$RUNTIME_ROOT/backups"
BACKUP_ID="${1:-$(date +%Y%m%d%H%M%S)}"
BACKUP_DIR="$BACKUP_ROOT/$BACKUP_ID"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP] $*" | tee -a "$RUNTIME_ROOT/logs/backup.log"; }
fail() { log "ERROR: $*"; exit 1; }

require_file() {
  [[ -f "$1" ]] || fail "缺少文件: $1"
}

load_env() {
  set -a
  source "$ENV_FILE"
  set +a
}

backup_database() {
  log "导出 MySQL 数据库: $DB_DATABASE"
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T mysql \
    mysqldump -uroot "-p$DB_ROOT_PASSWORD" \
    --single-transaction --routines --triggers --events \
    --default-character-set=utf8mb4 "$DB_DATABASE" \
    | gzip -9 > "$BACKUP_DIR/database.sql.gz"
}

backup_redis() {
  log "创建 Redis 持久化快照"
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T redis \
    redis-cli -a "$REDIS_PASSWORD" BGSAVE >/dev/null
  sleep 2
  cp -a "$RUNTIME_ROOT/data/redis/dump.rdb" "$BACKUP_DIR/redis.rdb" 2>/dev/null || true
}

backup_configuration() {
  log "备份运行时配置"
  cp "$ENV_FILE" "$BACKUP_DIR/compose.env"
  chmod 600 "$BACKUP_DIR/compose.env"
}

write_metadata() {
  cat > "$BACKUP_DIR/metadata.json" <<EOF
{
  "backupId": "$BACKUP_ID",
  "createdAt": "$(date -Iseconds)",
  "database": "$DB_DATABASE",
  "backendImage": "$(grep '^BACKEND_IMAGE=' "$ENV_FILE" | cut -d= -f2)",
  "appVersion": "$(grep '^APP_VERSION=' "$ENV_FILE" | cut -d= -f2 || echo 'unknown')"
}
EOF
}

main() {
  mkdir -p "$BACKUP_DIR" "$RUNTIME_ROOT/logs"
  require_file "$ENV_FILE"
  load_env
  backup_database
  backup_redis
  backup_configuration
  write_metadata
  log "备份完成: $BACKUP_ID"
  echo "$BACKUP_ID"
}

main "$@"
