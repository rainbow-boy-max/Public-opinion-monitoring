#!/bin/bash
#
# 备份清理脚本 - 按保留天数自动删除过期备份
# 保留 pre-restore 前缀的快照，不自动清理
#

set -euo pipefail

RUNTIME_ROOT="${RUNTIME_ROOT:-/www/server/opinion-monitor}"
BACKUP_ROOT="$RUNTIME_ROOT/backups"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
LOG_FILE="$RUNTIME_ROOT/logs/cleanup.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [CLEANUP] $*" | tee -a "$LOG_FILE"; }

main() {
  mkdir -p "$(dirname "$LOG_FILE")"

  if [[ ! -d "$BACKUP_ROOT" ]]; then
    log "备份目录不存在，跳过清理"
    return 0
  fi

  local deleted=0
  local kept=0

  for backup_dir in "$BACKUP_ROOT"/*/; do
    [[ -d "$backup_dir" ]] || continue

    local backup_id
    backup_id=$(basename "$backup_dir")

    # 保留 pre-restore 快照
    if [[ "$backup_id" == pre-restore-* ]]; then
      kept=$((kept + 1))
      continue
    fi

    # 按目录修改时间判断是否过期
    local mtime
    mtime=$(stat -c %Y "$backup_dir" 2>/dev/null || stat -f %m "$backup_dir" 2>/dev/null || echo 0)
    local now
    now=$(date +%s)
    local age_days=$(( (now - mtime) / 86400 ))

    if [[ $age_days -gt $RETENTION_DAYS ]]; then
      log "删除过期备份: $backup_id (${age_days}天)"
      rm -rf "$backup_dir"
      deleted=$((deleted + 1))
    else
      kept=$((kept + 1))
    fi
  done

  log "清理完成: 删除 ${deleted} 个，保留 ${kept} 个"
}

main "$@"
