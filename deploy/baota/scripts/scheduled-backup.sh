#!/bin/bash
#
# 定时备份脚本 - 适用于宝塔计划任务
# 用法：在宝塔计划任务中添加 Shell 脚本，执行本文件
#

set -euo pipefail

RUNTIME_ROOT="${RUNTIME_ROOT:-/www/server/opinion-monitor}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
BACKUP_SCRIPT="$RUNTIME_ROOT/scripts/backup-database.sh"
CLEANUP_SCRIPT="$RUNTIME_ROOT/scripts/cleanup-backups.sh"
LOG_FILE="$RUNTIME_ROOT/logs/scheduled-backup.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SCHEDULED] $*" | tee -a "$LOG_FILE"; }

main() {
  mkdir -p "$(dirname "$LOG_FILE")"

  log "=== 开始定时备份 ==="

  # 执行备份
  if [[ -x "$BACKUP_SCRIPT" ]]; then
    log "执行数据库备份..."
    "$BACKUP_SCRIPT" "auto-$(date +%Y%m%d%H%M%S)" >> "$LOG_FILE" 2>&1
    log "备份完成"
  else
    log "ERROR: 备份脚本不存在或不可执行: $BACKUP_SCRIPT"
    exit 1
  fi

  # 执行清理
  if [[ -x "$CLEANUP_SCRIPT" ]]; then
    log "执行备份清理（保留 ${RETENTION_DAYS} 天）..."
    RETENTION_DAYS="$RETENTION_DAYS" "$CLEANUP_SCRIPT" >> "$LOG_FILE" 2>&1
    log "清理完成"
  else
    log "WARN: 清理脚本不存在，跳过清理"
  fi

  log "=== 定时备份结束 ==="
}

main "$@"
