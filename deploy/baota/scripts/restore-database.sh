#!/bin/bash
#
# 数据库恢复脚本（恢复前自动创建快照）
#

set -euo pipefail

RUNTIME_ROOT="${RUNTIME_ROOT:-/www/server/opinion-monitor}"
COMPOSE_DIR="$RUNTIME_ROOT/compose"
ENV_FILE="$COMPOSE_DIR/.env"
BACKUP_ROOT="$RUNTIME_ROOT/backups"
BACKUP_ID="${1:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RESTORE] $*" | tee -a "$RUNTIME_ROOT/logs/restore.log"; }
fail() { log "ERROR: $*"; exit 1; }

load_env() {
  set -a
  source "$ENV_FILE"
  set +a
}

list_backups() {
  log "可用备份列表:"
  for backup_dir in "$BACKUP_ROOT"/*; do
    if [[ -d "$backup_dir" && -f "$backup_dir/metadata.json" ]]; then
      local backup_id=$(basename "$backup_dir")
      local created_at=$(jq -r '.createdAt' "$backup_dir/metadata.json" 2>/dev/null || echo "unknown")
      echo "  $backup_id  ($created_at)"
    fi
  done
}

create_pre_restore_snapshot() {
  log "恢复前创建当前数据库快照"
  "$RUNTIME_ROOT/scripts/backup-database.sh" "pre-restore-$(date +%Y%m%d%H%M%S)"
}

restore_database() {
  local backup_file="$BACKUP_ROOT/$BACKUP_ID/database.sql.gz"
  [[ -f "$backup_file" ]] || fail "备份文件不存在: $backup_file"

  log "恢复 MySQL 数据库: $DB_DATABASE"
  zcat "$backup_file" | docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T mysql \
    mysql -uroot "-p$DB_ROOT_PASSWORD" "$DB_DATABASE"
}

restore_redis() {
  local backup_file="$BACKUP_ROOT/$BACKUP_ID/redis.rdb"
  if [[ -f "$backup_file" ]]; then
    log "恢复 Redis 快照"
    docker compose -f "$COMPOSE_DIR/docker-compose.yml" stop redis
    cp -a "$backup_file" "$RUNTIME_ROOT/data/redis/dump.rdb"
    docker compose -f "$COMPOSE_DIR/docker-compose.yml" start redis
  else
    log "未找到 Redis 备份，跳过"
  fi
}

main() {
  mkdir -p "$RUNTIME_ROOT/logs"

  if [[ -z "$BACKUP_ID" ]]; then
    list_backups
    fail "用法: restore-database.sh <备份ID>"
  fi

  [[ -d "$BACKUP_ROOT/$BACKUP_ID" ]] || fail "备份不存在: $BACKUP_ID"

  load_env
  create_pre_restore_snapshot
  restore_database
  restore_redis
  log "恢复完成: $BACKUP_ID"
}

main "$@"
